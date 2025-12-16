$ErrorActionPreference = 'Stop'
$base='http://localhost:5005'
Write-Output "=== TEST: Validación de un único préstamo por grupo ==="

$login = Invoke-RestMethod -Method Post -Uri "$base/api/auth/login" -ContentType 'application/json' -Body (@{username='admin'; password='123'} | ConvertTo-Json)
$token = $login.data.token
$hdr = @{ Authorization = "Bearer $token" }

# Crear grupo
$group = Invoke-RestMethod -Method Post -Uri "$base/api/groups" -Headers $hdr -ContentType 'application/json' -Body (@{name='Grupo Test Unicidad'} | ConvertTo-Json)
Write-Output "✓ Grupo creado: $($group.data._id)"

# Crear personas
$dni1 = (Get-Random -Minimum 10000000 -Maximum 99999999).ToString()
$dni2 = (Get-Random -Minimum 10000000 -Maximum 99999999).ToString()
$person1 = Invoke-RestMethod -Method Post -Uri "$base/api/persons" -Headers $hdr -ContentType 'application/json' -Body (@{fullName='P1'; dni=$dni1; address='A1'; financialStatus='Good'; group=$group.data._id} | ConvertTo-Json -Depth 10)
$person2 = Invoke-RestMethod -Method Post -Uri "$base/api/persons" -Headers $hdr -ContentType 'application/json' -Body (@{fullName='P2'; dni=$dni2; address='A2'; financialStatus='Good'; group=$group.data._id} | ConvertTo-Json -Depth 10)
Write-Output "✓ 2 personas creadas"

# Aprobar personas
Invoke-RestMethod -Method Put -Uri "$base/api/groups/members/$($person1.data._id)" -Headers $hdr -ContentType 'application/json' -Body (@{dniChecked=$true; estadoFinancieroChecked=$true; carpetaCompletaChecked=$true; verificacionChecked=$true} | ConvertTo-Json) > $null
Invoke-RestMethod -Method Put -Uri "$base/api/groups/members/$($person2.data._id)" -Headers $hdr -ContentType 'application/json' -Body (@{dniChecked=$true; estadoFinancieroChecked=$true; carpetaCompletaChecked=$true; verificacionChecked=$true} | ConvertTo-Json) > $null
Write-Output "✓ Personas aprobadas"

# Crear accionista
$sh = Invoke-RestMethod -Method Post -Uri "$base/api/shareholders" -Headers $hdr -ContentType 'application/json' -Body (@{fullName='Accionista'; dni=((Get-Random -Minimum 10000000 -Maximum 99999999).ToString()); capitalContributed=1000} | ConvertTo-Json -Depth 6)
Write-Output "✓ Accionista creado"

# Crear primer préstamo
Write-Output ""
Write-Output "--- Creando 1er préstamo ---"
$loanBody = @{ groupId = $group.data._id; amount = 1000; numberOfInstallments = 2; shareholderContributions = @(@{shareholderId=$sh.data._id; amount=1000}) }
$loan1 = Invoke-RestMethod -Method Post -Uri "$base/api/loans" -Headers $hdr -ContentType 'application/json' -Body ($loanBody | ConvertTo-Json -Depth 10)
Write-Output "✓ 1er préstamo creado: $($loan1.data._id)"

# Intentar crear segundo préstamo
Write-Output ""
Write-Output "--- Intentando crear 2do préstamo (debe fallar) ---"
$result = Invoke-WebRequest -Uri "$base/api/loans" -Method Post -Headers $hdr -ContentType 'application/json' -Body ($loanBody | ConvertTo-Json -Depth 10) -SkipHttpErrorCheck

if ($result.StatusCode -eq 201) {
  Write-Output "ERROR: Se permitio crear segundo prestamo"
  exit 1
} else {
  $errorJson = ConvertFrom-Json $result.Content
  Write-Output "CORRECTO: Se rechazo 2do prestamo (Status $($result.StatusCode))"
  Write-Output "Mensaje: $($errorJson.error)"
}

Write-Output ""
Write-Output "=== TEST PASSED ==="
