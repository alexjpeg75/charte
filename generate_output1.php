<?php
$options = getopt('', ['logo:', 'keyart:', 'outdir::']);
$logoPath = $options['logo'] ?? null;
$keyArtPath = $options['keyart'] ?? null;
$outDir = $options['outdir'] ?? (__DIR__ . '/output1');

if ($logoPath === null || $keyArtPath === null) {
    fwrite(STDERR, "Usage: php generate_output1.php --logo=/path/logo.png --keyart=/path/keyart.png [--outdir=/path/output1]\n");
    exit(1);
}

if (!file_exists($logoPath) || !file_exists($keyArtPath)) {
    fwrite(STDERR, "Missing source images. Expected existing files:\n- {$logoPath}\n- {$keyArtPath}\n");
    exit(1);
}

if (!is_dir($outDir)) {
    mkdir($outDir, 0777, true);
}

$logo = imagecreatefrompng($logoPath);
$keyArt = imagecreatefrompng($keyArtPath);

imagesavealpha($logo, true);
imagesavealpha($keyArt, true);

$formats = [
    ['name' => 'feed_square_1080x1080.png', 'w' => 1080, 'h' => 1080, 'logoPos' => 'bottom_right'],
    ['name' => 'feed_portrait_1080x1350.png', 'w' => 1080, 'h' => 1350, 'logoPos' => 'bottom_right'],
    ['name' => 'story_1080x1920.png', 'w' => 1080, 'h' => 1920, 'logoPos' => 'top_center'],
    ['name' => 'reel_1080x1920.png', 'w' => 1080, 'h' => 1920, 'logoPos' => 'bottom_center'],
    ['name' => 'landscape_1920x1080.png', 'w' => 1920, 'h' => 1080, 'logoPos' => 'bottom_right'],
    ['name' => 'youtube_thumb_1280x720.png', 'w' => 1280, 'h' => 720, 'logoPos' => 'bottom_left'],
    ['name' => 'facebook_cover_1640x624.png', 'w' => 1640, 'h' => 624, 'logoPos' => 'right_center'],
    ['name' => 'x_header_1500x500.png', 'w' => 1500, 'h' => 500, 'logoPos' => 'right_center'],
    ['name' => 'linkedin_cover_1584x396.png', 'w' => 1584, 'h' => 396, 'logoPos' => 'right_center'],
    ['name' => 'poster_2000x3000.png', 'w' => 2000, 'h' => 3000, 'logoPos' => 'top_center'],
    ['name' => 'web_banner_970x250.png', 'w' => 970, 'h' => 250, 'logoPos' => 'right_center'],
    ['name' => 'mobile_banner_320x100.png', 'w' => 320, 'h' => 100, 'logoPos' => 'right_center'],
];

function drawBackgroundCover($canvas, $src, $cw, $ch) {
    $sw = imagesx($src);
    $sh = imagesy($src);
    $scale = max($cw / $sw, $ch / $sh);
    $dw = (int)ceil($sw * $scale);
    $dh = (int)ceil($sh * $scale);
    $dx = (int)(($cw - $dw) / 2);
    $dy = (int)(($ch - $dh) / 2);
    imagecopyresampled($canvas, $src, $dx, $dy, 0, 0, $dw, $dh, $sw, $sh);
}

function addGradientOverlay($canvas, $w, $h) {
    for ($y = 0; $y < $h; $y++) {
        $topAlpha = min(100, (int)(($y / $h) * 80));
        $botAlpha = min(120, (int)(((1 - $y / $h) * 100)));
        $a = min(127, (int)(35 + ($topAlpha * 0.2) + ($botAlpha * 0.25)));
        $color = imagecolorallocatealpha($canvas, 0, 0, 0, $a);
        imageline($canvas, 0, $y, $w, $y, $color);
    }
}

function placeLogo($canvas, $logo, $cw, $ch, $position) {
    $lw = imagesx($logo);
    $lh = imagesy($logo);

    $targetMaxW = (int)($cw * 0.42);
    $targetMaxH = (int)($ch * 0.33);
    $scale = min($targetMaxW / $lw, $targetMaxH / $lh);
    $dw = max(80, (int)($lw * $scale));
    $dh = max(80, (int)($lh * $scale));

    $padX = (int)($cw * 0.04);
    $padY = (int)($ch * 0.04);

    switch ($position) {
        case 'top_center':
            $x = (int)(($cw - $dw) / 2);
            $y = $padY;
            break;
        case 'bottom_center':
            $x = (int)(($cw - $dw) / 2);
            $y = $ch - $dh - $padY;
            break;
        case 'bottom_left':
            $x = $padX;
            $y = $ch - $dh - $padY;
            break;
        case 'right_center':
            $x = $cw - $dw - $padX;
            $y = (int)(($ch - $dh) / 2);
            break;
        case 'bottom_right':
        default:
            $x = $cw - $dw - $padX;
            $y = $ch - $dh - $padY;
            break;
    }

    imagealphablending($canvas, true);
    imagesavealpha($canvas, true);
    imagecopyresampled($canvas, $logo, $x, $y, 0, 0, $dw, $dh, $lw, $lh);
}

foreach ($formats as $f) {
    $w = $f['w'];
    $h = $f['h'];
    $canvas = imagecreatetruecolor($w, $h);
    imagealphablending($canvas, true);
    imagesavealpha($canvas, true);

    drawBackgroundCover($canvas, $keyArt, $w, $h);
    addGradientOverlay($canvas, $w, $h);
    placeLogo($canvas, $logo, $w, $h, $f['logoPos']);

    imagepng($canvas, $outDir . '/' . $f['name']);
    imagedestroy($canvas);
}

imagedestroy($logo);
imagedestroy($keyArt);

echo "Generated " . count($formats) . " compositions in output1\n";
