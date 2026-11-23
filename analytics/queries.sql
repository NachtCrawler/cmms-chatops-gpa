-- Cálculo del MTTR (Mean Time To Repair) en Horas
SELECT 
    COUNT(id_ticket) AS total_tickets_cerrados,
    ROUND(AVG(TIMESTAMPDIFF(SECOND, fecha_apertura, fecha_cierre) / 3600), 2) AS mttr_horas
FROM tickets
WHERE estatus = 'Cerrado';