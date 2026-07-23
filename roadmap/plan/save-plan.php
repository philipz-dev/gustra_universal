<?php
/**
 * Persist Gustra plan checkbox/section state as plan-state.json.
 * POST JSON body: { checked, sections, updatedAt }
 */
header('Content-Type: application/json; charset=utf-8');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(204);
    exit;
}

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode(['ok' => false, 'error' => 'POST required']);
    exit;
}

$raw = file_get_contents('php://input');
$data = json_decode($raw, true);
if (!is_array($data)) {
    http_response_code(400);
    echo json_encode(['ok' => false, 'error' => 'Invalid JSON']);
    exit;
}

$payload = [
    'checked' => isset($data['checked']) && is_array($data['checked']) ? $data['checked'] : new stdClass(),
    'sections' => isset($data['sections']) && is_array($data['sections']) ? $data['sections'] : [],
    'updatedAt' => isset($data['updatedAt']) ? (string) $data['updatedAt'] : gmdate('c'),
];

$path = __DIR__ . '/plan-state.json';
$json = json_encode($payload, JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT);
if ($json === false || file_put_contents($path, $json) === false) {
    http_response_code(500);
    echo json_encode(['ok' => false, 'error' => 'Write failed']);
    exit;
}

echo json_encode(['ok' => true, 'updatedAt' => $payload['updatedAt']]);
