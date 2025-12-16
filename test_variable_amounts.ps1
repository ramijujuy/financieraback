$ErrorActionPreference = 'Stop'
$base='http://localhost:5005'
Write-Output "TEST: Variable Loan Amounts"

$login = Invoke-RestMethod -Method Post -Uri "$base/api/auth/login" -ContentType 'application/json' -Body (@{username='admin'; password='123'} | ConvertTo-Json)
$token = $login.data.token
$hdr = @{ Authorization = "Bearer $token" }

$group = Invoke-RestMethod -Method Post -Uri "$base/api/groups" -Headers $hdr -ContentType 'application/json' -Body (@{name='Grupo Variado'} | ConvertTo-Json)
Write-Output "Grupo creado: $($group.data._id)"

$dni1 = (Get-Random -Minimum 10000000 -Maximum 99999999).ToString()
$dni2 = (Get-Random -Minimum 10000000 -Maximum 99999999).ToString()
$person1 = Invoke-RestMethod -Method Post -Uri "$base/api/persons" -Headers $hdr -ContentType 'application/json' -Body (@{fullName='Member One'; dni=$dni1; address='A1'; financialStatus='Good'; group=$group.data._id} | ConvertTo-Json -Depth 10)
$person2 = Invoke-RestMethod -Method Post -Uri "$base/api/persons" -Headers $hdr -ContentType 'application/json' -Body (@{fullName='Member Two'; dni=$dni2; address='A2'; financialStatus='Good'; group=$group.data._id} | ConvertTo-Json -Depth 10)
Write-Output "2 personas creadas: $($person1.data._id), $($person2.data._id)"

Invoke-RestMethod -Method Put -Uri "$base/api/groups/members/$($person1.data._id)" -Headers $hdr -ContentType 'application/json' -Body (@{dniChecked=$true; estadoFinancieroChecked=$true; carpetaCompletaChecked=$true; verificacionChecked=$true} | ConvertTo-Json) > $null
Invoke-RestMethod -Method Put -Uri "$base/api/groups/members/$($person2.data._id)" -Headers $hdr -ContentType 'application/json' -Body (@{dniChecked=$true; estadoFinancieroChecked=$true; carpetaCompletaChecked=$true; verificacionChecked=$true} | ConvertTo-Json) > $null
Write-Output "Personas aprobadas"

$sh = Invoke-RestMethod -Method Post -Uri "$base/api/shareholders" -Headers $hdr -ContentType 'application/json' -Body (@{fullName='Investor'; dni=((Get-Random -Minimum 10000000 -Maximum 99999999).ToString()); capitalContributed=10000} | ConvertTo-Json -Depth 6)
Write-Output "Accionista creado"

Write-Output ""
Write-Output "Creando prestamo con montos variables"
# Member 1: 500, Member 2: 1500. Total: 2000.
$memberAmounts = @(
    @{ memberId = $person1.data._id; amount = 500 },
    @{ memberId = $person2.data._id; amount = 1500 }
)
$loanBody = @{ 
    groupId = $group.data._id; 
    amount = 2000; 
    numberOfInstallments = 2; 
    shareholderContributions = @(@{shareholderId=$sh.data._id; amount=2000});
    memberAmounts = $memberAmounts
}

$loan = Invoke-RestMethod -Method Post -Uri "$base/api/loans" -Headers $hdr -ContentType 'application/json' -Body ($loanBody | ConvertTo-Json -Depth 10)
Write-Output "Prestamo creado: $($loan.data._id)"

# Verify created loan details
$details = $loan.data.memberDetails
$m1Detail = $details | Where-Object { $_.member._id -eq $person1.data._id }
$m2Detail = $details | Where-Object { $_.member._id -eq $person2.data._id }

Write-Output "Verificando montos..."
if ($m1Detail.amountPerPerson -eq 500) { Write-Output "OK: Member 1 amount is 500" } else { Write-Output "FAIL: Member 1 amount is $($m1Detail.amountPerPerson)" }
if ($m2Detail.amountPerPerson -eq 1500) { Write-Output "OK: Member 2 amount is 1500" } else { Write-Output "FAIL: Member 2 amount is $($m2Detail.amountPerPerson)" }

# Verify installments amount (roughly)
# 500 * 1.3 (15% * 2) = 650. Per installment (2) = 325.
# 1500 * 1.3 = 1950. Per installment (2) = 975.

$m1InstAmount = $m1Detail.installments[0].amount
$m2InstAmount = $m2Detail.installments[0].amount

if ([math]::abs($m1InstAmount - 325) -lt 1) { Write-Output "OK: Member 1 installment is correct ($m1InstAmount)" } else { Write-Output "FAIL: Member 1 installment is $m1InstAmount (expected ~325)" }
if ([math]::abs($m2InstAmount - 975) -lt 1) { Write-Output "OK: Member 2 installment is correct ($m2InstAmount)" } else { Write-Output "FAIL: Member 2 installment is $m2InstAmount (expected ~975)" }

Write-Output "TEST COMPLETED"
