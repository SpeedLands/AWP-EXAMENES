<?php
// /awp/api/notification_logic.php

/**
 * Genera los detalles de una notificación basándose en el módulo y la acción.
 *
 * @param string $module El módulo que origina la notificación (ej: 'exams').
 * @param string $action La acción realizada (ej: 'create', 'update', 'delete').
 * @return array Un array asociativo con 'title', 'body' y 'icon'.
 */
function getNotificationDetails($module, $action) {
    $titles = [
        'exams' => [
            'create' => "Nuevo Examen Creado",
            'update' => "Examen Actualizado Correctamente",
            'delete' => "Se ha Eliminado un Examen"
        ],
        'questions' => [
            'create' => "Nueva Pregunta Añadida",
            'update' => "Pregunta Actualizada Correctamente",
            'delete' => "Se ha Eliminado una Pregunta"
        ],
        'answers' => [
            'create' => "Nueva Respuesta Añadida",
            'update' => "Respuesta Actualizada Correctamente",
            'delete' => "Se ha Eliminado una Respuesta"
        ],
        'fills' => [
            'create' => "Has Recibido un Nuevo Formulario",
            'update' => "Formulario Actualizado Correctamente",
            'delete' => "Se ha Eliminado un Formulario"
        ]
    ];

    $title = $titles[$module][$action] ?? "Se han realizado cambios en el servidor";

    return [
        'title' => $title,
        'body'  => 'Verifica la aplicación para más detalles.',
        'icon'  => '/awp/images/icons/icon-512x512.png'
    ];
}
?>