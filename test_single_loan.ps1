$ErrorActionPreference = 'Stop'
$base='http://localhost:5005'
Write-Output "TEST: Validacion de un unico prestamo por grupo"

$login = Invoke-RestMethod -Method Post -Uri "$base/api/auth/login" -ContentType 'application/json' -Body (@{username='admin'; password='123'} | ConvertTo-Json)
$token = $login.data.token
$hdr = @{ Authorization = "Bearer $token" }

$group = Invoke-RestMethod -Method Post -Uri "$base/api/groups" -Headers $hdr -ContentType 'application/json' -Body (@{name='Grupo Test'} | ConvertTo-Json)
Write-Output "Grupo creado: $($group.data._id)"

$dni1 = (Get-Random -Minimum 10000000 -Maximum 99999999).ToString()
$dni2 = (Get-Random -Minimum 10000000 -Maximum 99999999).ToString()
$person1 = Invoke-RestMethod -Method Post -Uri "$base/api/persons" -Headers $hdr -ContentType 'application/json' -Body (@{fullName='P1'; dni=$dni1; address='A1'; financialStatus='Good'; group=$group.data._id} | ConvertTo-Json -Depth 10)
$person2 = Invoke-RestMethod -Method Post -Uri "$base/api/persons" -Headers $hdr -ContentType 'application/json' -Body (@{fullName='P2'; dni=$dni2; address='A2'; financialStatus='Good'; group=$group.data._id} | ConvertTo-Json -Depth 10)
Write-Output "2 personas creadas"

Invoke-RestMethod -Method Put -Uri "$base/api/groups/members/$($person1.data._id)" -Headers $hdr -ContentType 'application/json' -Body (@{dniChecked=$true; estadoFinancieroChecked=$true; carpetaCompletaChecked=$true; verificacionChecked=$true} | ConvertTo-Json) > $null
Invoke-RestMethod -Method Put -Uri "$base/api/groups/members/$($person2.data._id)" -Headers $hdr -ContentType 'application/json' -Body (@{dniChecked=$true; estadoFinancieroChecked=$true; carpetaCompletaChecked=$true; verificacionChecked=$true} | ConvertTo-Json) > $null
Write-Output "Personas aprobadas"

$sh = Invoke-RestMethod -Method Post -Uri "$base/api/shareholders" -Headers $hdr -ContentType 'application/json' -Body (@{fullName='Accionista'; dni=((Get-Random -Minimum 10000000 -Maximum 99999999).ToString()); capitalContributed=1000} | ConvertTo-Json -Depth 6)
Write-Output "Accionista creado"

Write-Output ""
Write-Output "Creando 1er prestamo"
$loanBody = @{ groupId = $group.data._id; amount = 1000; numberOfInstallments = 2; shareholderContributions = @(@{shareholderId=$sh.data._id; amount=1000}) }
$loan1 = Invoke-RestMethod -Method Post -Uri "$base/api/loans" -Headers $hdr -ContentType 'application/json' -Body ($loanBody | ConvertTo-Json -Depth 10)
Write-Output "OK: Prestamo 1 creado"

Write-Output ""
Write-Output "Intentando crear 2do prestamo"
$result = Invoke-WebRequest -Uri "$base/api/loans" -Method Post -Headers $hdr -ContentType 'application/json' -Body ($loanBody | ConvertTo-Json -Depth 10) -SkipHttpErrorCheck

if ($result.StatusCode -eq 201) {
  Write-Output "ERROR: Se permitio crear 2do prestamo"
  exit 1
}

$errorJson = ConvertFrom-Json $result.Content
Write-Output "OK: Se rechazo 2do prestamo (Status: $($result.StatusCode))"
Write-Output "Mensaje: $($errorJson.error)"
Write-Output ""
Write-Output "TEST PASSED"
