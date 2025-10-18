<?php
// /awp/api/login.php
require __DIR__ . '/../vendor/autoload.php';
use Firebase\JWT\JWT;

session_start();

header('Content-Type: application/json');
// Conexión a la BD (reutiliza tu script de conexión)
require 'db_connect.php'; 

$input = json_decode(file_get_contents('php://input'));
$email = $input->email ?? '';
$password = $input->password ?? '';

$stmt = $conn->prepare("SELECT id, password FROM usuarios WHERE email = ?");
$stmt->bind_param("s", $email);
$stmt->execute();
$result = $stmt->get_result();

if ($user = $result->fetch_assoc()) {
    if (password_verify($password, $user['password'])) {
        // ¡Contraseña correcta! Generamos el JWT.
        $secret_key = "TU_CLAVE_SECRETA_SUPER_SEGURA"; // ¡Cambia esto y guárdalo de forma segura!
        $issuer_claim = "http://localhost";
        $audience_claim = "http://localhost";
        $issuedat_claim = time();
        $expire_claim = $issuedat_claim + 3600; // 1 hora

        $token = array(
            "iss" => $issuer_claim,
            "aud" => $audience_claim,
            "iat" => $issuedat_claim,
            "exp" => $expire_claim,
            "data" => array(
                "user_id" => $user['id']
            )
        );

        $jwt = JWT::encode($token, $secret_key, 'HS256');

        $_SESSION['user_id'] = $user['id']; 

        // Estrategia Dual:
        // 1. Token real en cookie HttpOnly (Seguridad - Sección V.A)
        setcookie("access_token", $jwt, $expire_claim, "/", "", true, true);

        // 2. Devolvemos el payload para el "artefacto de sesión" offline
        http_response_code(200);
        echo json_encode(array(
            "message" => "Login exitoso.",
            "session_artifact" => $token['data'] // Contiene user_id
        ));
    } else {
        http_response_code(401);
        echo json_encode(array("message" => "Contraseña incorrecta."));
    }
} else {
    http_response_code(401);
    echo json_encode(array("message" => "Usuario no encontrado."));
}
?>