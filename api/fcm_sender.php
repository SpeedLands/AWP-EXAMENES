<?php
// /awp/api/fcm_sender.php

require __DIR__ . '/../vendor/autoload.php';

use Google\Auth\Credentials\ServiceAccountCredentials;
use GuzzleHttp\Client;
use GuzzleHttp\HandlerStack;
use GuzzleHttp\Exception\ClientException; // Aseguramos que la excepción esté importada

// --- CONFIGURACIÓN ---
// ATENCIÓN: Ajusta esta ruta si tu archivo JSON no está en /awp/firebase-adminsdk.json
const SERVICE_ACCOUNT_KEY_FILE = __DIR__ . '/../firebase-adminsdk.json'; 
const FCM_SCOPE = 'https://www.googleapis.com/auth/firebase.messaging';
const PROJECT_ID = 'examen-23-94c14'; // Tu ID de Proyecto de Firebase
// ----------------------


class FCMSender {
    private $client;
    private $fcmUrl; // Propiedad para almacenar la URL de envío

    public function __construct() {
        if (!file_exists(SERVICE_ACCOUNT_KEY_FILE)) {
            // Error de inicialización si la clave no se encuentra
            throw new Exception("Archivo de clave de servicio no encontrado: " . SERVICE_ACCOUNT_KEY_FILE);
        }

        $scopes = [FCM_SCOPE];

        // 1. Cargar las credenciales de la cuenta de servicio (maneja JWT/OAuth/Refresco)
        $credentials = new ServiceAccountCredentials(
            $scopes,
            SERVICE_ACCOUNT_KEY_FILE
        );

        // 2. Crear el middleware de autenticación (inyecta el token Bearer)
        $middleware = new \Google\Auth\Middleware\AuthTokenMiddleware($credentials);
        $stack = HandlerStack::create();
        $stack->push($middleware);

        // 3. Crear el cliente HTTP Guzzle
        $this->client = new Client([
            'handler' => $stack,
            // Sin base_uri, Guzzle usará la URL completa que definamos abajo
            'auth' => 'google_auth' 
        ]);

        // 4. Definir la URL completa y guardarla en la propiedad de la clase
        $this->fcmUrl = 'https://fcm.googleapis.com/v1/projects/' . PROJECT_ID . '/messages:send';
    }

    /**
     * Envía una notificación a un token específico.
     * @param string $token El token de registro del dispositivo.
     * @param string $title Título de la notificación.
     * @param string $body Cuerpo del mensaje.
     * @param string $icon URL del ícono para la notificación.
     * @param array $dataPayload Datos personalizados (opcional).
     * @return array El resultado de la API de FCM.
     */
    public function sendNotification(string $token, string $title, string $body, string $icon, array $dataPayload = []) {
        
        $messagePayload = [
            'message' => [
                'token' => $token,
                'notification' => [
                    'title' => $title,
                    'body' => $body
                ],
                'webpush' => [
                    'notification' => [
                        'icon' => $icon
                    ]
                ],
                'data' => $dataPayload
            ]
        ];

        try {
            $response = $this->client->post($this->fcmUrl, [
                'json' => $messagePayload
            ]);

            $statusCode = $response->getStatusCode();
            $body = (string) $response->getBody();

            if ($statusCode === 200) {
                return ['success' => true, 'response' => json_decode($body, true)];
            } else {
                return ['success' => false, 'error' => "FCM API Error ($statusCode): " . $body];
            }

        } catch (ClientException $e) {
             return ['success' => false, 'error' => "FCM Client Error: " . $e->getResponse()->getBody()];
        } catch (\Exception $e) {
            return ['success' => false, 'error' => "Error general: " . $e->getMessage()];
        }
    }
}