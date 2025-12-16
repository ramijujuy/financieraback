$ErrorActionPreference = "Stop"

# URLs y credenciales
$baseUrl = "http://localhost:5005"
$adminUser = @{
    email = "admin@test.com"
    password = "admin"
}

# Función para hacer request
function Make-Request {
    param(
        [string]$Method = "GET",
        [string]$Endpoint,
        [object]$Body,
        [hashtable]$Headers = @{}
    )
    $url = "$baseUrl$Endpoint"
    try {
        if ($Body) {
            $bodyJson = $Body | ConvertTo-Json
            $response = Invoke-WebRequest -Uri $url -Method $Method -Body $bodyJson -ContentType "application/json" -Headers $Headers -ErrorAction Stop
        } else {
            $response = Invoke-WebRequest -Uri $url -Method $Method -ContentType "application/json" -Headers $Headers -ErrorAction Stop
        }
        return $response.Content | ConvertFrom-Json
    }
    catch {
        Write-Host "ERROR: $_" -ForegroundColor Red
        return $null
    }
}

# PASO 1: Login
Write-Host "=== PASO 1: Login ===" -ForegroundColor Green
$loginRes = Make-Request -Method "POST" -Endpoint "/api/auth/login" -Body $adminUser
if ($loginRes.success) {
    $token = $loginRes.data.token
    Write-Host "✓ Login exitoso. Token: $($token.Substring(0,20))..." -ForegroundColor Green
    $headers = @{ "Authorization" = "Bearer $token" }
} else {
    Write-Host "✗ Login fallido" -ForegroundColor Red
    exit 1
}

# PASO 2: Crear Grupo
Write-Host "`n=== PASO 2: Crear Grupo ===" -ForegroundColor Green
$newGroup = @{
    name = "Grupo Test E2E $(Get-Random)"
    description = "Grupo de prueba E2E"
}
$groupRes = Make-Request -Method "POST" -Endpoint "/api/groups" -Body $newGroup -Headers $headers
if ($groupRes.success) {
    $groupId = $groupRes.data._id
    Write-Host "✓ Grupo creado: $($groupRes.data.name) (ID: $groupId)" -ForegroundColor Green
} else {
    Write-Host "✗ Error creando grupo: $($groupRes.error)" -ForegroundColor Red
    exit 1
}

# PASO 3: Crear Personas
Write-Host "`n=== PASO 3: Crear Personas ===" -ForegroundColor Green
$personIds = @()
for ($i = 1; $i -le 2; $i++) {
    $randomDni = (Get-Random -Minimum 10000000 -Maximum 99999999).ToString()
    $newPerson = @{
        fullName = "Persona $i Test"
        dni = $randomDni
        address = "Calle $i, 123"
        financialStatus = "Stable"
        group = $groupId
    }
    $personRes = Make-Request -Method "POST" -Endpoint "/api/persons" -Body $newPerson -Headers $headers
    if ($personRes.success) {
        $personIds += $personRes.data._id
        Write-Host "✓ Persona $i creada: $($personRes.data.fullName) (DNI: $randomDni)" -ForegroundColor Green
    } else {
        Write-Host "✗ Error creando persona $i" -ForegroundColor Red
    }
}

# PASO 4: Aprobar Miembros del Grupo
Write-Host "`n=== PASO 4: Aprobar Miembros ===" -ForegroundColor Green
foreach ($personId in $personIds) {
    $updateRes = Make-Request -Method "PUT" -Endpoint "/api/groups/members/$personId" `
        -Body @{ checks = @{ dniChecked = $true; estadoFinancieroChecked = $true; carpetaCompletaChecked = $true; verificacionChecked = $true } } `
        -Headers $headers
    if ($updateRes.success) {
        Write-Host "✓ Miembro $personId aprobado" -ForegroundColor Green
    }
}

# PASO 5: Crear Accionistas
Write-Host "`n=== PASO 5: Crear Accionistas ===" -ForegroundColor Green
$shareholder = @{
    name = "Accionista Test"
    dni = (Get-Random -Minimum 10000000 -Maximum 99999999).ToString()
    contribution = 1000
}
$shareholderRes = Make-Request -Method "POST" -Endpoint "/api/shareholders" -Body $shareholder -Headers $headers
if ($shareholderRes.success) {
    $shareholderId = $shareholderRes.data._id
    Write-Host "✓ Accionista creado (ID: $shareholderId)" -ForegroundColor Green
} else {
    Write-Host "✗ Error creando accionista" -ForegroundColor Red
}

# PASO 6: Crear Préstamo
Write-Host "`n=== PASO 6: Crear Préstamo ===" -ForegroundColor Green
$loan = @{
    group = $groupId
    amount = 1000
    installments = 2
    shareholderContributions = @(
        @{
            shareholder = $shareholderId
            contribution = 1000
        }
    )
}
$loanRes = Make-Request -Method "POST" -Endpoint "/api/loans" -Body $loan -Headers $headers
if ($loanRes.success) {
    $loanId = $loanRes.data._id
    Write-Host "✓ Préstamo creado (ID: $loanId) - Monto: \$$($loanRes.data.amount)" -ForegroundColor Green
} else {
    Write-Host "✗ Error creando préstamo: $($loanRes.error)" -ForegroundColor Red
    exit 1
}

# PASO 7: Obtener Cuenta Corriente del Grupo
Write-Host "`n=== PASO 7: Obtener Cuenta Corriente del Grupo ===" -ForegroundColor Green
$groupAccountRes = Make-Request -Method "GET" -Endpoint "/api/current-accounts/group/$groupId" -Headers $headers
if ($groupAccountRes.success) {
    Write-Host "✓ Cuenta corriente del grupo obtenida:" -ForegroundColor Green
    Write-Host "  - Monto Total: \$$($groupAccountRes.data.totalAmount)" -ForegroundColor Cyan
    Write-Host "  - Cuotas: $($groupAccountRes.data.installments.Count)" -ForegroundColor Cyan
    Write-Host "  - Total Pagado (por persona): \$$($groupAccountRes.data.personTotals.totalPaid)" -ForegroundColor Cyan
    Write-Host "  - Total Pendiente (por persona): \$$($groupAccountRes.data.personTotals.totalUnpaid)" -ForegroundColor Cyan
} else {
    Write-Host "✗ Error obteniendo cuenta del grupo" -ForegroundColor Red
}

# PASO 8: Obtener Cuentas de Personas
Write-Host "`n=== PASO 8: Obtener Cuentas de Personas ===" -ForegroundColor Green
foreach ($personId in $personIds) {
    $personAccountRes = Make-Request -Method "GET" -Endpoint "/api/current-accounts/person/$personId" -Headers $headers
    if ($personAccountRes.success) {
        Write-Host "✓ Persona $personId cuenta:" -ForegroundColor Green
        Write-Host "  - Monto: \$$($personAccountRes.data.totalAmount)" -ForegroundColor Cyan
        Write-Host "  - Pagado: \$$($personAccountRes.data.totalPaid)" -ForegroundColor Cyan
        Write-Host "  - Pendiente: \$$($personAccountRes.data.totalUnpaid)" -ForegroundColor Cyan
    }
}

# PASO 9: Marcar Cuota Pagada
Write-Host "`n=== PASO 9: Marcar Cuota Pagada ===" -ForegroundColor Green
$personAccountRes = Make-Request -Method "GET" -Endpoint "/api/current-accounts/person/$($personIds[0])" -Headers $headers
if ($personAccountRes.success) {
    $accountId = $personAccountRes.data._id
    $markRes = Make-Request -Method "PUT" -Endpoint "/api/current-accounts/$accountId/installments/1" `
        -Body @{ status = "paid"; paidDate = (Get-Date).ToUniversalTime().ToString("o") } `
        -Headers $headers
    if ($markRes.success) {
        Write-Host "✓ Cuota marcada como pagada" -ForegroundColor Green
        Write-Host "  - Nuevo Pagado: \$$($markRes.data.totalPaid)" -ForegroundColor Cyan
        Write-Host "  - Nuevo Pendiente: \$$($markRes.data.totalUnpaid)" -ForegroundColor Cyan
    }
}

# PASO 10: Verificar Cuenta del Grupo Actualizada
Write-Host "`n=== PASO 10: Verificar Cuenta del Grupo Actualizada ===" -ForegroundColor Green
$groupAccountRes = Make-Request -Method "GET" -Endpoint "/api/current-accounts/group/$groupId" -Headers $headers
if ($groupAccountRes.success) {
    Write-Host "✓ Cuenta corriente del grupo actualizada:" -ForegroundColor Green
    Write-Host "  - Monto Total: \$$($groupAccountRes.data.totalAmount)" -ForegroundColor Cyan
    Write-Host "  - Total Pagado (por persona): \$$($groupAccountRes.data.personTotals.totalPaid)" -ForegroundColor Cyan
    Write-Host "  - Total Pendiente (por persona): \$$($groupAccountRes.data.personTotals.totalUnpaid)" -ForegroundColor Cyan
} else {
    Write-Host "✗ Error obteniendo cuenta del grupo actualizada" -ForegroundColor Red
}

Write-Host "`n=== E2E COMPLETADO EXITOSAMENTE ===" -ForegroundColor Green
