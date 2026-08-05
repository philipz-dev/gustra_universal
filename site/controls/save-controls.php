<?php
/**
 * Persist Gustra control-audit submissions (back/close/confirm buttons).
 * POST JSON body: { userId, items, updatedAt }
 *   userId: per-visitor id (kept in localStorage), e.g. "u-abc123"
 *   items: { "<id>": { ok: bool, remark: string } }
 *
 * The server keeps a map of submissions keyed by userId, so every visitor's
 * checks and remarks are preserved and visible to others.
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

$userId = isset($data['userId']) && is_string($data['userId'])
    ? substr(preg_replace('/[^A-Za-z0-9\-_]/', '', $data['userId']), 0, 64)
    : '';
if ($userId === '') {
    // A cached old client may post without a userId. Fall back to an
    // anonymous id so the submission is still recorded instead of dropped.
    $userId = 'anon-' . substr(bin2hex(random_bytes(5)), 0, 8);
}

$items = [];
if (isset($data['items']) && is_array($data['items'])) {
    foreach ($data['items'] as $id => $entry) {
        if (!is_string($id) || !is_array($entry)) continue;
        $items[$id] = [
            'ok' => !empty($entry['ok']),
            'remark' => isset($entry['remark']) ? truncate_utf8((string) $entry['remark'], 500) : '',
        ];
    }
}

function truncate_utf8($s, $max) {
    if (function_exists('mb_substr')) {
        return mb_substr($s, 0, $max, 'UTF-8');
    }
    if (strlen($s) <= $max) return $s;
    $s = substr($s, 0, $max);
    while ($s !== '' && (ord($s[strlen($s) - 1]) & 0xC0) === 0x80) {
        $s = substr($s, 0, -1);
    }
    if ($s !== '' && (ord($s[strlen($s) - 1]) & 0xC0) === 0xC0) {
        $s = substr($s, 0, -1);
    }
    return $s;
}

$path = __DIR__ . '/controls-state.json';
$state = ['submissions' => [], 'updatedAt' => gmdate('c')];
if (file_exists($path)) {
    $existing = json_decode((string) file_get_contents($path), true);
    if (is_array($existing)) {
        if (isset($existing['submissions']) && is_array($existing['submissions'])) {
            $state['submissions'] = $existing['submissions'];
        } elseif (isset($existing['items']) && is_array($existing['items'])) {
            // legacy single-writer format → one anonymous submission
            $state['submissions']['legacy'] = [
                'items' => $existing['items'],
                'updatedAt' => isset($existing['updatedAt']) ? (string) $existing['updatedAt'] : gmdate('c'),
            ];
        }
    }
}

$now = gmdate('c');
$state['submissions'][$userId] = ['items' => $items, 'updatedAt' => $now];

// Keep the newest 60 submissions (FIFO) so the file cannot grow unbounded.
$subs = $state['submissions'];
if (count($subs) > 60) {
    uasort($subs, function ($a, $b) {
        return strcmp((string) ($a['updatedAt'] ?? ''), (string) ($b['updatedAt'] ?? ''));
    });
    $state['submissions'] = array_slice($subs, -60, null, true);
}

$state['updatedAt'] = $now;
$json = json_encode($state, JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT);
if ($json === false || file_put_contents($path, $json) === false) {
    http_response_code(500);
    echo json_encode(['ok' => false, 'error' => 'Write failed']);
    exit;
}

echo json_encode(['ok' => true, 'updatedAt' => $state['updatedAt']]);
