# Servidor local de ficheiros para a app NC Serralharia (pasta app/), em http://localhost:8765/
$raiz = Join-Path $PSScriptRoot 'app'
$tipos = @{ '.html'='text/html; charset=utf-8'; '.js'='text/javascript; charset=utf-8'; '.css'='text/css; charset=utf-8';
  '.svg'='image/svg+xml'; '.png'='image/png'; '.json'='application/json'; '.webmanifest'='application/manifest+json' }
$l = New-Object System.Net.HttpListener
$l.Prefixes.Add('http://localhost:8765/')
$l.Start()
Write-Host 'NC Serralharia em http://localhost:8765/'
while ($l.IsListening) {
  $c = $l.GetContext()
  try {
    $p = [Uri]::UnescapeDataString($c.Request.Url.AbsolutePath)
    if ($p.EndsWith('/')) { $p += 'index.html' }
    $f = [IO.Path]::GetFullPath((Join-Path $raiz $p.TrimStart('/')))
    if ($f.StartsWith($raiz) -and (Test-Path $f -PathType Leaf)) {
      $b = [IO.File]::ReadAllBytes($f)
      $t = $tipos[[IO.Path]::GetExtension($f).ToLower()]
      if (-not $t) { $t = 'application/octet-stream' }
      $c.Response.ContentType = $t
      $c.Response.Headers.Add('Cache-Control', 'no-cache')
      $c.Response.OutputStream.Write($b, 0, $b.Length)
    } else { $c.Response.StatusCode = 404 }
  } catch { try { $c.Response.StatusCode = 500 } catch {} }
  finally { try { $c.Response.Close() } catch {} }
}
