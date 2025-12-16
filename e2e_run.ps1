$ErrorActionPreference = 'Stop'
$base='http://localhost:5005'
Write-Output "Iniciando E2E script contra: $base"

try {
  Write-Output 'Login como admin...'
  $login = Invoke-RestMethod -Method Post -Uri "$base/api/auth/login" -ContentType 'application/json' -Body (@{username='admin'; password='123'} | ConvertTo-Json) -ErrorAction Stop
} catch { Write-Output "LOGIN ERROR: $_"; exit 1 }

$token = $login.data.token
if (-not $token) { Write-Output 'No se obtuvo token en login'; exit 1 }
$hdr = @{ Authorization = "Bearer $token" }
Write-Output "Login OK."

# Crear grupo
try {
  Write-Output 'Creando grupo E2E...'
  $group = Invoke-RestMethod -Method Post -Uri "$base/api/groups" -Headers $hdr -ContentType 'application/json' -Body (@{name='E2E Grupo'} | ConvertTo-Json) -ErrorAction Stop
  Write-Output "Grupo creado: $($group.data._id)"
} catch { Write-Output "CREATE GROUP ERROR: $_"; exit 1 }

# Generar DNIs aleatorios para evitar colisiones
$dni1 = (Get-Random -Minimum 10000000 -Maximum 99999999).ToString()
$dni2 = (Get-Random -Minimum 10000000 -Maximum 99999999).ToString()
Write-Output "DNI1: $dni1  DNI2: $dni2"

# Crear personas
try {
  Write-Output 'Creando Persona E1...'
  $person1 = Invoke-RestMethod -Method Post -Uri "$base/api/persons" -Headers $hdr -ContentType 'application/json' -Body (@{fullName='Persona E1'; dni=$dni1; address='Addr1'; financialStatus='Good'; group=$group.data._id} | ConvertTo-Json -Depth 10) -ErrorAction Stop
  Write-Output "Persona1: $($person1.data._id)"

  Write-Output 'Creando Persona E2...'
  $person2 = Invoke-RestMethod -Method Post -Uri "$base/api/persons" -Headers $hdr -ContentType 'application/json' -Body (@{fullName='Persona E2'; dni=$dni2; address='Addr2'; financialStatus='Good'; group=$group.data._id} | ConvertTo-Json -Depth 10) -ErrorAction Stop
  Write-Output "Persona2: $($person2.data._id)"
} catch { Write-Output "CREATE PERSON ERROR: $_"; exit 1 }

# Aprobar personas (marcar checks true)
try {
  Write-Output 'Aprobando Persona1...'
  Invoke-RestMethod -Method Put -Uri "$base/api/groups/members/$($person1.data._id)" -Headers $hdr -ContentType 'application/json' -Body (@{dniChecked=$true; estadoFinancieroChecked=$true; carpetaCompletaChecked=$true; verificacionChecked=$true} | ConvertTo-Json) -ErrorAction Stop > $null
  Write-Output 'Persona1 aprobada'

  Write-Output 'Aprobando Persona2...'
  Invoke-RestMethod -Method Put -Uri "$base/api/groups/members/$($person2.data._id)" -Headers $hdr -ContentType 'application/json' -Body (@{dniChecked=$true; estadoFinancieroChecked=$true; carpetaCompletaChecked=$true; verificacionChecked=$true} | ConvertTo-Json) -ErrorAction Stop > $null
  Write-Output 'Persona2 aprobada'
} catch { Write-Output "APPROVE MEMBER ERROR: $_"; exit 1 }

# Crear accionista
try {
  Write-Output 'Creando accionista...'
  $sh = Invoke-RestMethod -Method Post -Uri "$base/api/shareholders" -Headers $hdr -ContentType 'application/json' -Body (@{fullName='Accionista E1'; dni=((Get-Random -Minimum 10000000 -Maximum 99999999).ToString()); capitalContributed=1000} | ConvertTo-Json -Depth 6) -ErrorAction Stop
  Write-Output "Accionista creado: $($sh.data._id)"
} catch { Write-Output "CREATE SHAREHOLDER ERROR: $_"; exit 1 }

# Crear préstamo
try {
  Write-Output 'Creando préstamo...'
  $loanBody = @{ groupId = $group.data._id; amount = 1000; numberOfInstallments = 2; shareholderContributions = @(@{shareholderId=$sh.data._id; amount=1000}) }
  $loan = Invoke-RestMethod -Method Post -Uri "$base/api/loans" -Headers $hdr -ContentType 'application/json' -Body ($loanBody | ConvertTo-Json -Depth 10) -ErrorAction Stop
  Write-Output "Préstamo creado: $($loan.data._id)"
} catch { Write-Output "CREATE LOAN ERROR: $_"; exit 1 }

# Obtener cuenta corriente de grupo
try {
  Write-Output 'Obteniendo cuenta corriente del grupo...'
  $grpAcc = Invoke-RestMethod -Method Get -Uri "$base/api/current-accounts/group/$($group.data._id)" -Headers $hdr -ErrorAction Stop
  Write-Output "Cuenta grupo: totalAmount=$($grpAcc.data.totalAmount) installments=$($grpAcc.data.installments.Count) virtualPaid=$($grpAcc.data.totalPaid)"
  if ($grpAcc.data.personTotals) {
    Write-Output "PersonTotals in grpAcc: $($grpAcc.data.personTotals | ConvertTo-Json)"
  } else {
    Write-Output "PersonTotals in grpAcc: NOT PRESENT"
  }
} catch { Write-Output "GET GROUP ACCOUNT ERROR: $_"; exit 1 }

# Obtener cuentas de persona
try {
  Write-Output 'Obteniendo cuenta de Persona1...'
  $p1acc = Invoke-RestMethod -Method Get -Uri "$base/api/current-accounts/person/$($person1.data._id)" -Headers $hdr -ErrorAction Stop
  Write-Output "P1 cuenta: totalAmount=$($p1acc.data.totalAmount) installments=$($p1acc.data.installments.Count)"

  Write-Output 'Obteniendo cuenta de Persona2...'
  $p2acc = Invoke-RestMethod -Method Get -Uri "$base/api/current-accounts/person/$($person2.data._id)" -Headers $hdr -ErrorAction Stop
  Write-Output "P2 cuenta: totalAmount=$($p2acc.data.totalAmount) installments=$($p2acc.data.installments.Count)"
} catch { Write-Output "GET PERSON ACCOUNT ERROR: $_"; exit 1 }

# Marcar cuota 1 de Persona1 como pagada
try {
  Write-Output 'Marcando cuota 1 de Persona1 como pagada...'
  $body = @{ status = 'paid'; paidDate = (Get-Date).ToString('o') }
  $paid = Invoke-RestMethod -Method Put -Uri "$base/api/current-accounts/$($p1acc.data._id)/installments/1" -Headers $hdr -ContentType 'application/json' -Body ($body | ConvertTo-Json) -ErrorAction Stop
  Write-Output "Cuota marcada."
  Write-Output "P1 after mark: totalPaid=$($paid.data.totalPaid) installments=$($paid.data.installments | ConvertTo-Json -Depth 2)"
} catch { Write-Output "MARK INSTALLMENT ERROR: $_"; exit 1 }

# Re-verificar cuentas
try {
  Write-Output 'Re-obteniendo cuenta de grupo...'
  $grpAcc2 = Invoke-RestMethod -Method Get -Uri "$base/api/current-accounts/group/$($group.data._id)" -Headers $hdr -ErrorAction Stop
  Write-Output "Grupo after payment: totalAmount=$($grpAcc2.data.totalAmount) virtualPaid=$($grpAcc2.data.totalPaid) virtualUnpaid=$($grpAcc2.data.totalUnpaid)"
  if ($grpAcc2.data.personTotals) {
    Write-Output "PersonTotals after: totalPaid=$($grpAcc2.data.personTotals.totalPaid) totalUnpaid=$($grpAcc2.data.personTotals.totalUnpaid)"
  } else {
    Write-Output "PersonTotals after: NOT PRESENT"
  }

  Write-Output 'Re-obteniendo cuenta de Persona1...'
  $p1acc2 = Invoke-RestMethod -Method Get -Uri "$base/api/current-accounts/person/$($person1.data._id)" -Headers $hdr -ErrorAction Stop
  Write-Output "Persona1 after payment: totalAmount=$($p1acc2.data.totalAmount) virtualPaid=$($p1acc2.data.totalPaid) virtualUnpaid=$($p1acc2.data.totalUnpaid)"
} catch { Write-Output "RE-FETCH ACCOUNTS ERROR: $_"; exit 1 }

Write-Output 'E2E script finished'
