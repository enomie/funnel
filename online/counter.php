<?php
/**
 * FUNNEL - Session-based visitor counter
 * Stores count outside the public web root (_data/) and returns JSON.
 */

declare(strict_types=1);

session_start();

header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-cache, must-revalidate');

$dataDir = __DIR__ . '/_data';
$file = $dataDir . '/visits.txt';
$legacyFile = __DIR__ . '/visits.txt';

if (!is_dir($dataDir)) {
    mkdir($dataDir, 0750, true);
}

if (!file_exists($file) && file_exists($legacyFile)) {
    rename($legacyFile, $file);
}

$count = 0;
if (file_exists($file)) {
    $raw = file_get_contents($file);
    $count = is_string($raw) ? (int)trim($raw) : 0;
} else {
    file_put_contents($file, '0', LOCK_EX);
}

if (empty($_SESSION['funnel_counted'])) {
    $count++;
    file_put_contents($file, (string)$count, LOCK_EX);
    $_SESSION['funnel_counted'] = true;
}

echo json_encode([
    'status' => 'success',
    'visits' => $count,
], JSON_THROW_ON_ERROR);
