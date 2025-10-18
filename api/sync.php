<?php
// /awp/api/sync.php
ini_set('display_errors', 1);
error_reporting(E_ALL);

session_start();

// 1. Establecer encabezado y manejador de errores JSON
header('Content-Type: application/json');

// Un manejador de errores simple para depuración
set_error_handler(function($severity, $message, $file, $line) {
    http_response_code(500);
    echo json_encode(['error' => "PHP Error: $message in $file on line $line"]);
    exit;
});

$sql_base_examenes = "
    SELECT
        e.idExamen,
        e.tituloexamen,
        e.descripcion,
        
        COALESCE((
            SELECT
                COUNT(p.idPregunta)
            FROM
                preguntas p
            WHERE
                p.idExamen = e.idExamen
        ), 0) AS numero_preguntas,
        
        COALESCE((
            SELECT
                SUM(p.valor)
            FROM
                preguntas p
            WHERE
                p.idExamen = e.idExamen
        ), 0) AS puntaje_total_examen,
        
        COALESCE((
            SELECT
                COUNT(DISTINCT l.Clave)
            FROM
                llenados l
            JOIN respuestas r ON l.IdRespuesta = r.idRespuesta
            JOIN preguntas p ON r.idPregunta = p.idPregunta
            WHERE
                p.idExamen = e.idExamen
        ), 0) AS personas_han_contestado
        
    FROM
        examenes e
";


try {
    // --- CONEXIÓN A LA BASE DE DATOS ---
    // ¡Asegúrate de que estos valores son correctos!
    require_once 'db_connect.php';

    // --- MANEJO DE LA PETICIÓN ---
    $method = $_SERVER['REQUEST_METHOD'];

    if ($method === 'GET') {
        // --- MANEJO DE PETICIONES GET ---

        // CASO 1: Obtener un solo examen
        if (isset($_GET['scope']) && $_GET['scope'] === 'examen' && isset($_GET['id'])) {
            $examen_id = (int)$_GET['id'];

            $sql = $sql_base_examenes . " WHERE e.idExamen = ?";

            $stmt = $conn->prepare($sql);
            $stmt->bind_param("i", $examen_id);
            $stmt->execute();
            $result = $stmt->get_result();
            $examen = $result->fetch_assoc();
            $stmt->close();
            echo json_encode($examen);
            exit; // Salimos para no ejecutar el resto del código GET
        }

        // CASO 2: Obtener la lista pública de exámenes
        if (isset($_GET['scope']) && $_GET['scope'] === 'examenes_publicos') {
            
            $sql = $sql_base_examenes . " ORDER BY e.idExamen";
            $result = $conn->query($sql);
            $examenes = array();
            if ($result && $result->num_rows > 0) {
                while($row = $result->fetch_assoc()) {
                    $examenes[] = $row;
                }
            }
            echo json_encode($examenes);
            exit;
        }

        // CASO 3: Obtener las preguntas de un examen (como hacía get_preguntas.php)
        if (isset($_GET['scope']) && $_GET['scope'] === 'preguntas' && isset($_GET['examen_id'])) {
            $examen_id = (int)$_GET['examen_id'];
            
            $sql = "
                SELECT 
                    p.idPregunta, 
                    p.pregunta AS question,
                    r.idRespuesta,
                    r.respuesta AS `option`,
                    r.correcta AS is_correct
                FROM 
                    preguntas p
                JOIN 
                    respuestas r ON p.idPregunta = r.idPregunta
                WHERE 
                    p.idExamen = ?
                ORDER BY
                    p.idPregunta; -- La ordenación es clave para agrupar
            ";

            $stmt = $conn->prepare($sql);
            if ($stmt === false) {
                throw new Exception('Error al preparar la consulta: ' . $conn->error);
            }

            $stmt->bind_param("i", $examen_id);
            $stmt->execute();
            $result = $stmt->get_result();

            $preguntas_agrupadas = [];
            if ($result->num_rows > 0) {
                while ($row = $result->fetch_assoc()) {
                    $idPregunta = $row['idPregunta'];

                    // Si es la primera vez que vemos esta pregunta, creamos su entrada
                    if (!isset($preguntas_agrupadas[$idPregunta])) {
                        $preguntas_agrupadas[$idPregunta] = [
                            'id'       => $idPregunta,
                            'question' => $row['question'],
                            'options'  => []
                        ];
                    }

                    // Añadimos la opción actual a la pregunta correspondiente
                    $preguntas_agrupadas[$idPregunta]['options'][] = [
                        'option'     => $row['option'],
                        'idRespuesta' => $row['idRespuesta'],
                        'is_correct' => (int)$row['is_correct']
                    ];
                }
            }
            $stmt->close();
            echo json_encode(array_values($preguntas_agrupadas));
            exit;
        }

        if (isset($_GET['scope']) && $_GET['scope'] === 'clasificacion' && isset($_GET['idExamen'])) {
            // Validamos que el idExamen sea numérico
            if (!is_numeric($_GET['idExamen'])) {
                http_response_code(400); // Bad Request
                echo json_encode(['error' => 'idExamen no es válido.']);
                exit;
            }
            
            $idExamen = (int)$_GET['idExamen'];

            $sql = "
                SELECT
                    l.Clave,
                    SUM(CASE WHEN r.correcta = 1 THEN p.valor ELSE 0 END) AS puntaje_obtenido,
                    
                    -- Subconsulta Escalar para calcular el puntaje máximo (1er ?)
                    (
                        SELECT SUM(valor)
                        FROM preguntas
                        WHERE idExamen = ?
                    ) AS puntaje_maximo,
                    
                    -- Cálculo del porcentaje usando la subconsulta (2do ?)
                    (
                        SUM(CASE WHEN r.correcta = 1 THEN p.valor ELSE 0 END) * 100.0 / 
                        (
                            SELECT SUM(valor)
                            FROM preguntas
                            WHERE idExamen = ?
                        )
                    ) AS porcentaje
                FROM
                    llenados l
                JOIN respuestas r ON l.IdRespuesta = r.idRespuesta
                JOIN preguntas p ON r.idPregunta = p.idPregunta
                WHERE
                    p.idExamen = ? -- WHERE principal (3er ?)
                GROUP BY
                    l.Clave
                ORDER BY
                    puntaje_obtenido DESC, l.Clave ASC;
            ";

            $stmt = $conn->prepare($sql);
            if ($stmt === false) {
                throw new Exception('Error al preparar la consulta de clasificación: ' . $conn->error);
            }

            // *** SOLUCIÓN: Cambiar "ii" a "iii" ***
            $stmt->bind_param("iii", $idExamen, $idExamen, $idExamen);
            $stmt->execute();
            $result = $stmt->get_result();

            $clasificacion = [];
            if ($result) {
                $clasificacion = $result->fetch_all(MYSQLI_ASSOC);
            }

            $stmt->close();
            
            echo json_encode($clasificacion);
            exit;
        }

        // --- OBTENER NOTIFICACIONES DEL USUARIO ---
        if (isset($_GET['scope']) && $_GET['scope'] === 'notificaciones') {
            $user_id = $_SESSION['user_id'] ?? null;

            if (!$user_id) {
                http_response_code(401);
                echo json_encode(['error' => 'No autenticado para listar notificaciones.']);
                exit;
            }

            // Seleccionamos las notificaciones dirigidas a este usuario, ordenadas por fecha reciente
            $sql = "
                SELECT 
                    id,
                    titulo,
                    cuerpo,
                    data_payload,
                    estado_envio,
                    fecha_envio
                FROM 
                    notificaciones_registro
                WHERE 
                    user_id = ?
                ORDER BY 
                    fecha_envio DESC
                LIMIT 50; -- Limitar a 50 para evitar sobrecarga
            ";

            $stmt = $conn->prepare($sql);
            $stmt->bind_param("i", $user_id);
            $stmt->execute();
            $result = $stmt->get_result();

            $notificaciones = [];
            if ($result && $result->num_rows > 0) {
                while ($row = $result->fetch_assoc()) {
                    // Si data_payload se guarda como string, lo parseamos aquí para el cliente
                    $row['data_payload'] = json_decode($row['data_payload'], true);
                    $notificaciones[] = $row;
                }
            }
            $stmt->close();

            echo json_encode($notificaciones);
            exit; // Salimos para devolver solo la lista de notificaciones
        }

        $data = [
            'examenes' => [],
            'preguntas' => [],
            'respuestas' => [],
            'llenados' => []
        ];

        // CORREGIDO: Añadimos la lectura de 'last_modified'
        $result = $conn->query("SELECT idExamen as server_id, tituloExamen as nombre, descripcion, last_modified FROM examenes");
        while ($row = $result->fetch_assoc()) {
            $data['examenes'][] = $row;
        }

        $result = $conn->query("SELECT idPregunta as server_id, idExamen as examen_id_ref, pregunta, valor, last_modified FROM preguntas");
        while ($row = $result->fetch_assoc()) {
            $data['preguntas'][] = $row;
        }
        
        $result = $conn->query("SELECT idRespuesta as server_id, idPregunta as pregunta_id_ref, respuesta, correcta, last_modified FROM respuestas");
        while ($row = $result->fetch_assoc()) {
            $data['respuestas'][] = $row;
        }

        $sql = "
            SELECT 
                l.idLlenado as server_id, 
                l.Clave, 
                l.IdRespuesta, 
                p.idExamen as examen_id_ref,
                l.last_modified 
            FROM llenados l
            JOIN respuestas r ON l.IdRespuesta = r.idRespuesta
            JOIN preguntas p ON r.idPregunta = p.idPregunta
        ";
        $result = $conn->query($sql);
        while ($row = $result->fetch_assoc()) {
            $data['llenados'][] = $row;
        }

        echo json_encode($data);

    } elseif ($method === 'POST') {
        // --- MANEJO DE PETICIONES POST ---
        $input = json_decode(file_get_contents('php://input'));
        if (json_last_error() !== JSON_ERROR_NONE) {
            throw new Exception("JSON inválido recibido.");
        }

        // CORREGIDO: Adaptado al formato que envía app.js { type: '...', payload: {...} }
        $type = $input->type ?? null;
        $payload = $input->payload ?? null;

        if (!$type || !$payload) {
            throw new Exception("Formato de payload incorrecto. Se esperaba 'type' y 'payload'.");
        }

        switch ($type) {
            case 'examen':
                $local_id = $payload->local_id;
                $server_id = $payload->server_id;
                $nombre = $payload->nombre;
                $descripcion = $payload->descripcion;
                $last_modified = $payload->last_modified;

                // CORRECCIÓN DE SEGURIDAD: Usar Prepared Statements
                if (empty($server_id)) {
                    // CREAR (INSERT)
                    $stmt = $conn->prepare("INSERT INTO examenes (tituloExamen, descripcion, last_modified) VALUES (?, ?, ?)");
                    $stmt->bind_param("sss", $nombre, $descripcion, $last_modified);
                    $stmt->execute();
                    $new_server_id = $conn->insert_id;
                    $stmt->close();

                    // CORREGIDO: Devolver la respuesta que el cliente espera
                    echo json_encode([
                        'type' => 'examen',
                        'data' => [
                            'local_id' => $local_id,
                            'server_id' => $new_server_id,
                            'last_modified' => $last_modified
                        ]
                    ]);

                } else {
                    // ACTUALIZAR (UPDATE)
                    // TODO: Implementar lógica Last-Write-Wins aquí si es necesario
                    $stmt = $conn->prepare("UPDATE examenes SET tituloExamen = ?, descripcion = ?, last_modified = ? WHERE idExamen = ?");
                    $stmt->bind_param("sssi", $nombre, $descripcion, $last_modified, $server_id);
                    $stmt->execute();
                    $stmt->close();

                    echo json_encode([
                        'type' => 'examen',
                        'data' => [
                            'local_id' => $local_id,
                            'server_id' => $server_id,
                            'last_modified' => $last_modified
                        ]
                    ]);
                }
                break;
            case 'pregunta':
                $payload = $input->payload;
                $local_id = $payload->local_id;
                $server_id = $payload->server_id;
                
                // Usamos el server_id del padre que nos envía el cliente
                $examen_server_id = $payload->examen_server_id_ref;

                // Verificación: No podemos crear una pregunta si su examen padre no está sincronizado
                if (empty($examen_server_id)) {
                    // En un caso real, podríamos encolar esto en el servidor o devolver un error.
                    // Por ahora, simplemente no hacemos nada para evitar errores de clave foránea.
                    http_response_code(409); // 409 Conflict - indica que el estado del recurso impide la petición
                    echo json_encode(['error' => 'El examen padre no está sincronizado. La pregunta no se puede guardar en el servidor.']);
                    break;
                }

                if (empty($server_id)) {
                    // CREAR PREGUNTA
                    $stmt = $conn->prepare("INSERT INTO preguntas (idExamen, pregunta, valor, last_modified) VALUES (?, ?, ?, ?)");
                    $stmt->bind_param("isds", $examen_server_id, $payload->pregunta, $payload->valor, $payload->last_modified);
                    $stmt->execute();
                    $new_server_id = $conn->insert_id;
                    $stmt->close();

                    echo json_encode([
                        'type' => 'pregunta',
                        'data' => [
                            'local_id' => $local_id,
                            'server_id' => $new_server_id,
                            'last_modified' => $payload->last_modified
                        ]
                    ]);
                } else {
                    // ACTUALIZAR PREGUNTA
                    $stmt = $conn->prepare("UPDATE preguntas SET pregunta = ?, valor = ?, last_modified = ? WHERE idPregunta = ?");
                    $stmt->bind_param("sdsi", $payload->pregunta, $payload->valor, $payload->last_modified, $server_id);
                    $stmt->execute();
                    $stmt->close();

                    echo json_encode([
                        'type' => 'pregunta',
                        'data' => [
                            'local_id' => $local_id,
                            'server_id' => $server_id,
                            'last_modified' => $payload->last_modified
                        ]
                    ]);
                }
                break;
            case 'respuesta':
                $payload = $input->payload;
                $local_id = $payload->local_id;
                $server_id = $payload->server_id;
                
                // Usamos el server_id de la pregunta padre que nos envía el cliente
                $pregunta_server_id = $payload->pregunta_server_id_ref;

                if (empty($pregunta_server_id)) {
                    http_response_code(409); // Conflict
                    echo json_encode(['error' => 'La pregunta padre no está sincronizada. La respuesta no se puede guardar en el servidor.']);
                    break;
                }

                if (empty($server_id)) {
                    // CREAR RESPUESTA
                    $stmt = $conn->prepare("INSERT INTO respuestas (idPregunta, respuesta, correcta, last_modified) VALUES (?, ?, ?, ?)");
                    $stmt->bind_param("isis", $pregunta_server_id, $payload->respuesta, $payload->correcta, $payload->last_modified);
                    $stmt->execute();
                    $new_server_id = $conn->insert_id;
                    $stmt->close();

                    echo json_encode([
                        'type' => 'respuesta',
                        'data' => [
                            'local_id' => $local_id,
                            'server_id' => $new_server_id,
                            'last_modified' => $payload->last_modified
                        ]
                    ]);
                } else {
                    // ACTUALIZAR RESPUESTA
                    $stmt = $conn->prepare("UPDATE respuestas SET respuesta = ?, correcta = ?, last_modified = ? WHERE idRespuesta = ?");
                    $stmt->bind_param("sisi", $payload->respuesta, $payload->correcta, $payload->last_modified, $server_id);
                    $stmt->execute();
                    $stmt->close();

                    echo json_encode([
                        'type' => 'respuesta',
                        'data' => [
                            'local_id' => $local_id,
                            'server_id' => $server_id,
                            'last_modified' => $payload->last_modified
                        ]
                    ]);
                }
                break;
            case 'llenado':
                $payload = $input->payload;
                $local_id = $payload->local_id;
                $server_id = $payload->server_id;
                
                // CORRECCIÓN: Un llenado depende de un examen, no de una respuesta.
                // Y el app.js no envía esta referencia, así que la comentamos por ahora.
                // La relación real es Llenado -> IdRespuesta.
                
                if (empty($server_id)) {
                    // CREAR LLENADO
                    // Como no tenemos una UI para crear llenados, esta lógica es para el futuro.
                    $stmt = $conn->prepare("INSERT INTO llenados (Clave, IdRespuesta, last_modified) VALUES (?, ?, ?)");
                    $stmt->bind_param("sis", $payload->Clave, $payload->IdRespuesta, $payload->last_modified);
                    $stmt->execute();
                    $new_server_id = $conn->insert_id;
                    $stmt->close();

                    echo json_encode([
                        'type' => 'llenado',
                        'data' => ['local_id' => $local_id, 'server_id' => $new_server_id, 'last_modified' => $payload->last_modified]
                    ]);
                } else {
                    // ACTUALIZAR LLENADO
                    $stmt = $conn->prepare("UPDATE llenados SET Clave = ?, IdRespuesta = ?, last_modified = ? WHERE idLlenado = ?");
                    // CORRECCIÓN: Usamos las propiedades correctas del payload.
                    $stmt->bind_param("sisi", $payload->Clave, $payload->IdRespuesta, $payload->last_modified, $server_id);
                    $stmt->execute();
                    $stmt->close();

                    echo json_encode([
                        'type' => 'llenado',
                        'data' => ['local_id' => $local_id, 'server_id' => $server_id, 'last_modified' => $payload->last_modified]
                    ]);
                }
                break;
            case 'submit_examen':
                $clave = $payload->clave ?? null;
                $respuestas = $payload->respuestas ?? []; // Array de IDs de respuesta
                
                if (empty($clave) || empty($respuestas) || !is_array($respuestas)) {
                    http_response_code(400); // Bad Request
                    echo json_encode(['error' => 'Datos inválidos. Se requiere una clave y un array de respuestas.']);
                    exit;
                }

                // Usamos una transacción para asegurar que todas las respuestas se guarden juntas
                $conn->begin_transaction();

                try {
                    // Preparamos la consulta UNA SOLA VEZ fuera del bucle
                    $stmt = $conn->prepare("INSERT INTO llenados (Clave, IdRespuesta) VALUES (?, ?)");

                    foreach ($respuestas as $idRespuesta) {
                        $idRespuestaInt = (int)$idRespuesta;
                        // Bindeamos los parámetros y ejecutamos por cada respuesta
                        $stmt->bind_param("si", $clave, $idRespuestaInt);
                        $stmt->execute();
                    }

                    // Si todo fue bien, confirmamos los cambios
                    $conn->commit();
                    $stmt->close();

                    echo json_encode(['success' => true, 'message' => 'Examen guardado correctamente.']);

                } catch (Exception $e) {
                    // Si algo falla, revertimos todos los cambios
                    $conn->rollback();
                    http_response_code(500);
                    echo json_encode(['error' => 'Error al guardar el examen.', 'details' => $e->getMessage()]);
                }
                break;
            case 'fcm_token':
                
                $fcmToken = $payload->token ?? null;
                // Obtener el ID del usuario de la sesión de PHP
                $userId = $_SESSION['user_id'] ?? null; 

                if (!$fcmToken) {
                    http_response_code(400);
                    echo json_encode(['error' => 'Token FCM faltante.']);
                    break;
                }
                if (!$userId) {
                    http_response_code(401);
                    echo json_encode(['error' => 'Usuario no autenticado para guardar el token.']);
                    break;
                }

                // Asegúrate de que la tabla `usuarios` tenga una columna `fcm_token` (VARCHAR 255 o más)
                $stmt = $conn->prepare("UPDATE usuarios SET fcm_token = ? WHERE id = ?");
                $stmt->bind_param("si", $fcmToken, $userId);
                $stmt->execute();
                $stmt->close();
                
                echo json_encode(['success' => true, 'message' => 'Token guardado']);
                break;
        }
    } elseif ($method === 'DELETE') {
        // --- MANEJO DE PETICIONES DELETE ---
        $input = json_decode(file_get_contents('php://input'));
        $type = $input->type ?? null;
        $server_id = $input->server_id ?? null;

        if (!$type || !$server_id) {
            http_response_code(400); // Bad Request
            echo json_encode(['error' => 'Tipo o server_id faltante en la petición DELETE.']);
            exit;
        }

        $tableName = '';
        $idColumnName = '';

        switch ($type) {
            case 'examen':
                $tableName = 'examenes';
                $idColumnName = 'idExamen';
                break;
            case 'pregunta':
                $tableName = 'preguntas';
                $idColumnName = 'idPregunta';
                break;
            case 'respuesta':
                $tableName = 'respuestas';
                $idColumnName = 'idRespuesta';
                break;
            case 'llenado':
                $tableName = 'llenados';
                $idColumnName = 'idLlenado';
                break;
            default:
                http_response_code(400);
                echo json_encode(['error' => "Tipo desconocido: $type"]);
                exit;
        }

        // Usamos Prepared Statements para seguridad
        // NOTA: No podemos usar '?' para nombres de tablas o columnas, por eso los validamos antes.
        $stmt = $conn->prepare("DELETE FROM `$tableName` WHERE `$idColumnName` = ?");
        $stmt->bind_param("i", $server_id);
        $stmt->execute();
        
        if ($stmt->affected_rows > 0) {
            http_response_code(204); // 204 No Content - Éxito
        } else {
            // Opcional: Devolver un error si no se encontró el ID para borrar
            http_response_code(404); // Not Found
            echo json_encode(['error' => "No se encontró el registro con ID $server_id en la tabla $tableName."]);
        }
    }

    $conn->close();

} catch (Exception $e) {
    http_response_code(500);
    echo json_encode(['error' => 'Exception', 'message' => $e->getMessage()]);
}
?>