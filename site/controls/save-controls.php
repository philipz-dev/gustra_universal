<?php
/**
 * Persist Gustra control-audit submissions (https://gustra.net/controls/).
 * POST JSON body: { userId, name, items, updatedAt }
 *   userId: per-visitor id (kept in localStorage), e.g. "u-abc123"
 *   name:   optional editor name (kept in a cookie on the client). When given
 *           it must be unique: the server rejects with 409 name_taken if
 *           another visitor already submitted with the same name.
 *   items: { "<id>": { ok: bool, remark: string } }
 *
 * The server keeps a map of submissions keyed by userId, so every visitor's
 * checks and remarks are preserved and visible to others.
 *
 * Admin (name "Philipz", case-insensitive) may additionally send:
 *   { action: "adminEdit", targetUid, itemId, remark, name }
 *   { action: "adminDelete", targetUid, itemId, name }
 * to edit or delete one item of another visitor's submission. The name check is
 * server-side; a non-Philipz name gets 403.
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

function lowercase_utf8($s) {
    return function_exists('mb_strtolower') ? mb_strtolower($s, 'UTF-8') : strtolower($s);
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

$action = isset($data['action']) && is_string($data['action']) ? $data['action'] : '';
if ($action === 'adminEdit' || $action === 'adminDelete') {
    $adminName = isset($data['name']) && is_string($data['name']) ? trim($data['name']) : '';
    if (lowercase_utf8($adminName) !== 'philipz') {
        http_response_code(403);
        echo json_encode(['ok' => false, 'error' => 'not_admin']);
        exit;
    }
    $targetUid = isset($data['targetUid']) && is_string($data['targetUid'])
        ? substr(preg_replace('/[^A-Za-z0-9\-_]/', '', $data['targetUid']), 0, 64)
        : '';
    $itemId = isset($data['itemId']) && is_string($data['itemId'])
        ? substr(preg_replace('/[^A-Za-z0-9\-_]/', '', $data['itemId']), 0, 80)
        : '';
    if ($targetUid === '' || $itemId === '' || !isset($state['submissions'][$targetUid])) {
        http_response_code(404);
        echo json_encode(['ok' => false, 'error' => 'not_found']);
        exit;
    }
    $sub = $state['submissions'][$targetUid];
    if (!isset($sub['items']) || !is_array($sub['items']) || !isset($sub['items'][$itemId])) {
        http_response_code(404);
        echo json_encode(['ok' => false, 'error' => 'item_not_found']);
        exit;
    }
    if ($action === 'adminDelete') {
        unset($sub['items'][$itemId]);
    } else {
        $remark = isset($data['remark']) ? truncate_utf8((string) $data['remark'], 500) : '';
        $ok = !empty($sub['items'][$itemId]['ok']);
        $sub['items'][$itemId] = ['ok' => $ok, 'remark' => $remark];
    }
    $sub['updatedAt'] = gmdate('c');
    $state['submissions'][$targetUid] = $sub;
    $state['updatedAt'] = gmdate('c');
    $json = json_encode($state, JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT);
    if ($json === false || file_put_contents($path, $json) === false) {
        http_response_code(500);
        echo json_encode(['ok' => false, 'error' => 'Write failed']);
        exit;
    }
    echo json_encode(['ok' => true, 'updatedAt' => $state['updatedAt']]);
    exit;
}

$name = isset($data['name']) && is_string($data['name']) ? trim($data['name']) : '';
if ($name !== '') {
    $name = truncate_utf8($name, 40);
    $isAdminName = lowercase_utf8($name) === 'philipz';
    // Uniqueness: the editor's name must not already be claimed by another
    // visitor (case-insensitive, our own previous submission excluded).
    // The admin name "Philipz" is exempt so the owner can always sign in.
    foreach ($state['submissions'] as $uid => $sub) {
        if ($uid === $userId) continue;
        $otherName = isset($sub['name']) && is_string($sub['name']) ? trim($sub['name']) : '';
        if ($otherName !== '' && lowercase_utf8($otherName) === lowercase_utf8($name) && !$isAdminName) {
            http_response_code(409);
            echo json_encode(['ok' => false, 'error' => 'name_taken', 'name' => $name]);
            exit;
        }
    }
}

$now = gmdate('c');
$state['submissions'][$userId] = ['name' => $name, 'items' => $items, 'updatedAt' => $now];

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
