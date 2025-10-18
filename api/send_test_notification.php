<?php
// /awp/api/send_test_notification.php

ini_set('display_errors', 1);
error_reporting(E_ALL);

header('Content-Type: application/json');

// Necesitamos la conexión a la DB, la sesión de usuario y las funciones de FCM
session_start();
require 'db_connect.php'; 
require 'fcm_sender.php'; 

// --- DEFINICIÓN DE MENSAJE GENÉRICO ---
$titulo = 'Sincronización Admin';
$cuerpo = 'Se han realizado cambios en el servidor. Verifica la aplicación.';
// Esta variable se actualizará con el ID de la sesión más abajo
$sourceUserId = $_SESSION['user_id'] ?? 0; 
$dataPayload = ['action' => 'sync_complete', 'source_user_id' => (string)$sourceUserId]; 
// -------------------------------------

try {
    $currentUserId = $_SESSION['user_id'] ?? null;
    if (!$currentUserId) {
        http_response_code(401);
        echo json_encode(['error' => 'No autorizado. La sesión de usuario es requerida.']);
        exit;
    }

    // 1. OBTENER TODOS LOS TOKENS DE ADMINISTRADORES
    // Buscamos todos los usuarios que tengan un token FCM válido
    $stmt = $conn->prepare("SELECT id, fcm_token FROM usuarios WHERE fcm_token IS NOT NULL AND fcm_token != ''");
    $stmt->execute();
    $result = $stmt->get_result();
    
    $adminTokens = [];
    while ($row = $result->fetch_assoc()) {
        $adminTokens[] = [
            'token' => $row['fcm_token'],
            'user_id' => $row['id'] // ID del destinatario
        ];
    }
    $stmt->close();
    
    if (empty($adminTokens)) {
        http_response_code(200); 
        echo json_encode(['success' => false, 'error' => 'No hay administradores con tokens registrados.']);
        exit;
    }

    // 2. INICIALIZAR ENVIADOR
    $sender = new FCMSender();
    $globalSuccess = true;
    
    // 3. ITERAR, ENVIAR Y REGISTRAR POR CADA ADMINISTRADOR
    foreach ($adminTokens as $admin) {
        
        $fcmToken = $admin['token'];
        $userId = $admin['user_id']; // ID del administrador destinatario
        
        // El payload debe reflejar el ID del usuario que realizó la acción
        $dataPayload['source_user_id'] = (string)$currentUserId;
        
        // A. ENVIAR NOTIFICACIÓN
        $result = $sender->sendNotification(
            $fcmToken,
            $titulo,
            $cuerpo,
            $dataPayload
        );

        // B. REGISTRAR EL INTENTO DE ENVÍO
        $estado_envio = $result['success'] ? 'ENVIADO' : 'FALLIDO';
        $error_fcm = !$result['success'] ? substr($result['error'], 0, 250) : null;
        $fecha_envio = date('Y-m-d H:i:s');
        $dataPayloadJson = json_encode($dataPayload);

        $stmt = $conn->prepare("
            INSERT INTO notificaciones_registro 
            (user_id, fcm_token, titulo, cuerpo, data_payload, estado_envio, error_fcm, fecha_envio)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        ");
        
        // Usamos el ID del destinatario ($userId) para el registro
        $stmt->bind_param("isssisss", 
            $userId, 
            $fcmToken, 
            $titulo, 
            $cuerpo, 
            $dataPayloadJson, 
            $estado_envio, 
            $error_fcm, 
            $fecha_envio
        );
        $stmt->execute();
        $stmt->close();

        if (!$result['success']) {
            $globalSuccess = false;
        }
    }
    
    // 4. RESPUESTA FINAL
    if ($globalSuccess) {
        http_response_code(200);
        echo json_encode(['success' => true, 'message' => 'Notificación enviada a todos los administradores.']);
    } else {
        // Devolvemos 200 aunque haya fallado alguno, para no romper el flujo de login en JS
        http_response_code(200); 
        echo json_encode(['success' => false, 'error' => 'Algunos envíos a administradores fallaron. Verifique logs.']);
    }

} catch (Exception $e) {
    // Si falla la inicialización (ej: FCMSender), es un error 500
    http_response_code(500);
    echo json_encode(['success' => false, 'error' => 'Error de inicialización o conexión.', 'details' => $e->getMessage()]);
}
?>