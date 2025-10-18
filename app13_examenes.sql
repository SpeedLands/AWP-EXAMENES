-- phpMyAdmin SQL Dump
-- version 5.2.1
-- https://www.phpmyadmin.net/
--
-- Servidor: 127.0.0.1
-- Tiempo de generación: 18-10-2025 a las 00:21:21
-- Versión del servidor: 10.4.32-MariaDB
-- Versión de PHP: 8.2.12

SET SQL_MODE = "NO_AUTO_VALUE_ON_ZERO";
START TRANSACTION;
SET time_zone = "+00:00";


/*!40101 SET @OLD_CHARACTER_SET_CLIENT=@@CHARACTER_SET_CLIENT */;
/*!40101 SET @OLD_CHARACTER_SET_RESULTS=@@CHARACTER_SET_RESULTS */;
/*!40101 SET @OLD_COLLATION_CONNECTION=@@COLLATION_CONNECTION */;
/*!40101 SET NAMES utf8mb4 */;

--
-- Base de datos: `awp`
--

-- --------------------------------------------------------

--
-- Estructura de tabla para la tabla `examenes`
--

CREATE TABLE `examenes` (
  `idExamen` bigint(20) NOT NULL,
  `tituloExamen` varchar(100) NOT NULL,
  `descripcion` varchar(100) NOT NULL,
  `last_modified` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Volcado de datos para la tabla `examenes`
--

INSERT INTO `examenes` (`idExamen`, `tituloExamen`, `descripcion`, `last_modified`) VALUES
(1, 'Examen Teórico Parcial 1 AS', 'Examen teórico del primer parcial de arquitecturas de software.', '2025-10-17 07:06:17');

-- --------------------------------------------------------

--
-- Estructura de tabla para la tabla `llenados`
--

CREATE TABLE `llenados` (
  `idLlenado` bigint(20) NOT NULL,
  `Clave` varchar(100) NOT NULL,
  `IdRespuesta` bigint(20) NOT NULL,
  `last_modified` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Volcado de datos para la tabla `llenados`
--

INSERT INTO `llenados` (`idLlenado`, `Clave`, `IdRespuesta`, `last_modified`) VALUES
(1, 'JUAN', 2, '2025-10-14 00:35:59'),
(2, 'JUAN', 3, '2025-10-08 13:37:44');

-- --------------------------------------------------------

--
-- Estructura de tabla para la tabla `notificaciones_registro`
--

CREATE TABLE `notificaciones_registro` (
  `id` int(10) UNSIGNED NOT NULL,
  `user_id` int(11) DEFAULT NULL,
  `fcm_token` varchar(500) DEFAULT NULL,
  `titulo` varchar(255) NOT NULL,
  `cuerpo` text NOT NULL,
  `data_payload` text DEFAULT NULL,
  `estado_envio` enum('ENVIADO','FALLIDO','PENDIENTE') NOT NULL DEFAULT 'PENDIENTE',
  `error_fcm` varchar(255) DEFAULT NULL,
  `fecha_envio` datetime NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Volcado de datos para la tabla `notificaciones_registro`
--

INSERT INTO `notificaciones_registro` (`id`, `user_id`, `fcm_token`, `titulo`, `cuerpo`, `data_payload`, `estado_envio`, `error_fcm`, `fecha_envio`) VALUES
(1, 1, 'fR1qE50zQiTImNCsYlj5lt:APA91bE0WGJMn-9AbQ0PWy_XYyJ6hTeCv3k6027kQ586vRxZtsm55A2S8M3XiW7HbVlRZ-iqGpuY_6632C29K8hV-sT_izktOnLYCNM8uZwRyLl6POBaXIY', 'Sincronización Admin', 'Se han realizado cambios en el servidor. Verifica la aplicación.', '0', 'ENVIADO', NULL, '2025-10-16 13:25:32'),
(2, 1, 'e8b9Suyikx9qPcpnXY1zPd:APA91bExOuS9L03fnvXg2AG0tDfDuo7HyzqvWJ_2UGFD9cLGCNT2GwoekqMsQmSWZaE_3O1Xo4AMMuYcXvt9C8mf4biBZfrlYTmKWbR69rOn_B29s5amacU', 'Sincronización Admin', 'Se han realizado cambios en el servidor. Verifica la aplicación.', '0', 'ENVIADO', NULL, '2025-10-16 21:51:22'),
(3, 1, 'eb689sK5r0xWH31PbcQLD4:APA91bEHYRPIBBOLwtcZTfsNpiWY4dnj-9hooBHyJm7Wt0iEKD46Z1usuPXSrnBJz1m-Tw5taF2y1OTk6kbgaJFiPIQPXnTQGf3KlQ_E-dyaV2Zk6Czh-rw', 'Sincronización Admin', 'Se han realizado cambios en el servidor. Verifica la aplicación.', '0', 'ENVIADO', NULL, '2025-10-16 22:54:52'),
(4, 1, 'eb689sK5r0xWH31PbcQLD4:APA91bEHYRPIBBOLwtcZTfsNpiWY4dnj-9hooBHyJm7Wt0iEKD46Z1usuPXSrnBJz1m-Tw5taF2y1OTk6kbgaJFiPIQPXnTQGf3KlQ_E-dyaV2Zk6Czh-rw', 'Sincronización Admin', 'Se han realizado cambios en el servidor. Verifica la aplicación.', '0', 'FALLIDO', 'Error general: cURL error 6: Could not resolve host: oauth2.googleapis.com (see https://curl.haxx.se/libcurl/c/libcurl-errors.html) for https://oauth2.googleapis.com/token', '2025-10-17 01:50:45'),
(5, 1, 'eb689sK5r0xWH31PbcQLD4:APA91bEHYRPIBBOLwtcZTfsNpiWY4dnj-9hooBHyJm7Wt0iEKD46Z1usuPXSrnBJz1m-Tw5taF2y1OTk6kbgaJFiPIQPXnTQGf3KlQ_E-dyaV2Zk6Czh-rw', 'Sincronización Admin', 'Se han realizado cambios en el servidor. Verifica la aplicación.', '0', 'ENVIADO', NULL, '2025-10-17 01:52:33'),
(6, 1, 'e-7-ZKfMRgzSnOyMTg8uG-:APA91bGJpEA6kWMgz0Yo_yFVaBad21IGEAC7AUrlZd-fjE4OKPqgK1Y_9RH19dMPGZNP12Lt0ezaNgsFherxG2Qk6zxQgD6xcceMfRq1MBLnf1YwHvJt1uo', 'Sincronización Admin', 'Se han realizado cambios en el servidor. Verifica la aplicación.', '0', 'ENVIADO', NULL, '2025-10-17 04:06:23');

-- --------------------------------------------------------

--
-- Estructura de tabla para la tabla `preguntas`
--

CREATE TABLE `preguntas` (
  `idPregunta` bigint(20) NOT NULL,
  `idExamen` bigint(20) NOT NULL,
  `pregunta` varchar(500) NOT NULL,
  `valor` double DEFAULT NULL,
  `last_modified` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Volcado de datos para la tabla `preguntas`
--

INSERT INTO `preguntas` (`idPregunta`, `idExamen`, `pregunta`, `valor`, `last_modified`) VALUES
(1, 1, 'Arquitectura ideal para proyectos de seguimiento en tiempo real.', 7.5, '2025-10-08 06:53:24'),
(2, 1, 'Arquitectura ideal para proyectos que requieran usar recursos externos.', 7.5, '2025-10-14 00:27:55');

-- --------------------------------------------------------

--
-- Estructura de tabla para la tabla `respuestas`
--

CREATE TABLE `respuestas` (
  `idRespuesta` bigint(20) NOT NULL,
  `idPregunta` bigint(20) NOT NULL,
  `respuesta` varchar(500) NOT NULL,
  `correcta` int(11) NOT NULL,
  `last_modified` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Volcado de datos para la tabla `respuestas`
--

INSERT INTO `respuestas` (`idRespuesta`, `idPregunta`, `respuesta`, `correcta`, `last_modified`) VALUES
(1, 1, 'Cliente-Servidor', 0, '2025-10-08 06:53:24'),
(2, 1, 'Dirigida a eventos', 1, '2025-10-08 06:53:24'),
(3, 1, 'Serverless', 0, '2025-10-08 06:53:24'),
(4, 2, 'Cliente-Servidor', 0, '2025-10-08 06:53:24'),
(5, 2, 'Dirigida a eventos', 0, '2025-10-08 06:53:24'),
(6, 2, 'Serverless', 1, '2025-10-14 03:34:02');

-- --------------------------------------------------------

--
-- Estructura de tabla para la tabla `usuarios`
--

CREATE TABLE `usuarios` (
  `id` int(11) NOT NULL,
  `email` varchar(255) NOT NULL,
  `password` varchar(255) NOT NULL,
  `nombre` varchar(100) DEFAULT NULL,
  `fecha_creacion` timestamp NOT NULL DEFAULT current_timestamp(),
  `fcm_token` varchar(500) DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Volcado de datos para la tabla `usuarios`
--

INSERT INTO `usuarios` (`id`, `email`, `password`, `nombre`, `fecha_creacion`, `fcm_token`) VALUES
(1, 'admin@gmail.com', '$2y$10$Epwt9l/vt4bZdVZEzBCg..0pKgjnzCT0fPmVoPCsAd5YxlZPcCjN.', 'Administrador', '2025-10-08 10:53:32', 'eHNQhNEiENYzy1wBYMn0ph:APA91bFall0HO1R54IankNJKJYFEe1r8WIFxaoEeOQWcO4VPBHfPShXNC8lso41hC8doBAEf2DavsWH_b-YwJ-J08Z-PQMF-f5mTbiUtyUv4USFI4yfuYpE');

--
-- Índices para tablas volcadas
--

--
-- Indices de la tabla `examenes`
--
ALTER TABLE `examenes`
  ADD PRIMARY KEY (`idExamen`);

--
-- Indices de la tabla `llenados`
--
ALTER TABLE `llenados`
  ADD PRIMARY KEY (`idLlenado`),
  ADD KEY `IdRespuesta` (`IdRespuesta`);

--
-- Indices de la tabla `notificaciones_registro`
--
ALTER TABLE `notificaciones_registro`
  ADD PRIMARY KEY (`id`),
  ADD KEY `user_id` (`user_id`);

--
-- Indices de la tabla `preguntas`
--
ALTER TABLE `preguntas`
  ADD PRIMARY KEY (`idPregunta`),
  ADD KEY `idExamen` (`idExamen`);

--
-- Indices de la tabla `respuestas`
--
ALTER TABLE `respuestas`
  ADD PRIMARY KEY (`idRespuesta`),
  ADD KEY `idPregunta` (`idPregunta`);

--
-- Indices de la tabla `usuarios`
--
ALTER TABLE `usuarios`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `email_unique` (`email`);

--
-- AUTO_INCREMENT de las tablas volcadas
--

--
-- AUTO_INCREMENT de la tabla `examenes`
--
ALTER TABLE `examenes`
  MODIFY `idExamen` bigint(20) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=7;

--
-- AUTO_INCREMENT de la tabla `llenados`
--
ALTER TABLE `llenados`
  MODIFY `idLlenado` bigint(20) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=13;

--
-- AUTO_INCREMENT de la tabla `notificaciones_registro`
--
ALTER TABLE `notificaciones_registro`
  MODIFY `id` int(10) UNSIGNED NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=7;

--
-- AUTO_INCREMENT de la tabla `preguntas`
--
ALTER TABLE `preguntas`
  MODIFY `idPregunta` bigint(20) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=4;

--
-- AUTO_INCREMENT de la tabla `respuestas`
--
ALTER TABLE `respuestas`
  MODIFY `idRespuesta` bigint(20) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=8;

--
-- AUTO_INCREMENT de la tabla `usuarios`
--
ALTER TABLE `usuarios`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=2;

--
-- Restricciones para tablas volcadas
--

--
-- Filtros para la tabla `llenados`
--
ALTER TABLE `llenados`
  ADD CONSTRAINT `llenados_ibfk_1` FOREIGN KEY (`IdRespuesta`) REFERENCES `respuestas` (`idRespuesta`);

--
-- Filtros para la tabla `notificaciones_registro`
--
ALTER TABLE `notificaciones_registro`
  ADD CONSTRAINT `notificaciones_registro_ibfk_1` FOREIGN KEY (`user_id`) REFERENCES `usuarios` (`id`) ON DELETE SET NULL;

--
-- Filtros para la tabla `preguntas`
--
ALTER TABLE `preguntas`
  ADD CONSTRAINT `preguntas_ibfk_1` FOREIGN KEY (`idExamen`) REFERENCES `examenes` (`idExamen`);

--
-- Filtros para la tabla `respuestas`
--
ALTER TABLE `respuestas`
  ADD CONSTRAINT `respuestas_ibfk_1` FOREIGN KEY (`idPregunta`) REFERENCES `preguntas` (`idPregunta`);
COMMIT;

/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
