using System;
using System.Diagnostics;
using System.IO;
using System.Net;
using System.Net.Sockets;
using System.Text;
using System.Threading;
using System.Windows.Forms;

namespace EarnVoice
{
    static class Program
    {
        private static HttpListener _listener;
        private static Thread _serverThread;
        private static bool _isRunning = true;
        private static string _appDir;
        private static int _port = 5174;
        private static Process _phpProcess = null;

        [STAThread]
        static void Main()
        {
            try
            {
                string baseDir = AppDomain.CurrentDomain.BaseDirectory;
                _appDir = Path.Combine(baseDir, "app");
                if (!Directory.Exists(_appDir))
                {
                    // Fallback to current directory or frontend dist if running in dev
                    string fallback = Path.Combine(baseDir, "..\\..\\frontend\\dist");
                    if (Directory.Exists(fallback)) _appDir = Path.GetFullPath(fallback);
                }

                // Check backend
                EnsureBackendRunning(baseDir);

                // Find open port
                _port = GetAvailablePort(5174);

                // Start local static & proxy web server
                StartWebServer();

                // Launch Edge in Standalone App Mode
                string appUrl = "http://127.0.0.1:" + _port + "/";
                Process browserProc = LaunchAppBrowser(appUrl);

                if (browserProc != null)
                {
                    browserProc.WaitForExit();
                }
                else
                {
                    // Fallback to default browser
                    Process.Start(appUrl);
                    Thread.Sleep(3000);
                }
            }
            catch (Exception ex)
            {
                MessageBox.Show("Error starting EarnVoice: " + ex.Message, "EarnVoice Error", MessageBoxButtons.OK, MessageBoxIcon.Error);
            }
            finally
            {
                Cleanup();
            }
        }

        static void EnsureBackendRunning(string baseDir)
        {
            try
            {
                // Test if backend is already listening
                using (TcpClient client = new TcpClient())
                {
                    IAsyncResult ar = client.BeginConnect("127.0.0.1", 8000, null, null);
                    bool success = ar.AsyncWaitHandle.WaitOne(800);
                    if (success && client.Connected)
                    {
                        client.EndConnect(ar);
                        return; // Backend already running
                    }
                }
            }
            catch { }

            // Try to find backend directory and php
            string[] possibleBackendPaths = new string[]
            {
                Path.Combine(baseDir, "..\\..\\backend"),
                Path.Combine(baseDir, "..\\backend"),
                Path.Combine(baseDir, "backend")
            };

            foreach (var bPath in possibleBackendPaths)
            {
                string fullPath = Path.GetFullPath(bPath);
                string artisan = Path.Combine(fullPath, "artisan");
                if (File.Exists(artisan))
                {
                    try
                    {
                        ProcessStartInfo psi = new ProcessStartInfo("php", "artisan serve --port=8000 --host=127.0.0.1");
                        psi.WorkingDirectory = fullPath;
                        psi.CreateNoWindow = true;
                        psi.UseShellExecute = false;
                        psi.WindowStyle = ProcessWindowStyle.Hidden;
                        _phpProcess = Process.Start(psi);
                        Thread.Sleep(1200);
                        break;
                    }
                    catch { }
                }
            }
        }

        static int GetAvailablePort(int startingPort)
        {
            for (int p = startingPort; p < startingPort + 20; p++)
            {
                try
                {
                    TcpListener l = new TcpListener(IPAddress.Loopback, p);
                    l.Start();
                    l.Stop();
                    return p;
                }
                catch { }
            }
            return startingPort;
        }

        static void StartWebServer()
        {
            _listener = new HttpListener();
            _listener.Prefixes.Add("http://127.0.0.1:" + _port + "/");
            _listener.Start();

            _serverThread = new Thread(() =>
            {
                while (_isRunning && _listener != null && _listener.IsListening)
                {
                    try
                    {
                        HttpListenerContext ctx = _listener.GetContext();
                        ThreadPool.QueueUserWorkItem(ProcessRequest, ctx);
                    }
                    catch
                    {
                        if (!_isRunning) break;
                    }
                }
            });
            _serverThread.IsBackground = true;
            _serverThread.Start();
        }

        static void ProcessRequest(object state)
        {
            HttpListenerContext ctx = (HttpListenerContext)state;
            try
            {
                string rawUrl = ctx.Request.RawUrl;
                string path = rawUrl.Split('?')[0].TrimStart('/');

                // Proxy /api/ requests directly to Laravel backend
                if (rawUrl.StartsWith("/api/"))
                {
                    ProxyToBackend(ctx);
                    return;
                }

                if (string.IsNullOrEmpty(path))
                {
                    path = "index.html";
                }

                string filePath = Path.Combine(_appDir, path.Replace('/', '\\'));

                // SPA fallback for routing paths like /transactions, /budgets, etc.
                if (!File.Exists(filePath))
                {
                    if (!path.Contains("."))
                    {
                        filePath = Path.Combine(_appDir, "index.html");
                    }
                }

                if (File.Exists(filePath))
                {
                    byte[] data = File.ReadAllBytes(filePath);
                    string ext = Path.GetExtension(filePath).ToLower();
                    ctx.Response.ContentType = GetMimeType(ext);
                    ctx.Response.ContentLength64 = data.Length;
                    ctx.Response.StatusCode = 200;
                    ctx.Response.OutputStream.Write(data, 0, data.Length);
                }
                else
                {
                    ctx.Response.StatusCode = 404;
                    byte[] notFound = Encoding.UTF8.GetBytes("Not Found");
                    ctx.Response.OutputStream.Write(notFound, 0, notFound.Length);
                }
            }
            catch { }
            finally
            {
                try { ctx.Response.OutputStream.Close(); } catch { }
            }
        }

        static void ProxyToBackend(HttpListenerContext ctx)
        {
            try
            {
                string targetUrl = "http://127.0.0.1:8000" + ctx.Request.RawUrl;
                HttpWebRequest req = (HttpWebRequest)WebRequest.Create(targetUrl);
                req.Method = ctx.Request.HttpMethod;
                req.ContentType = ctx.Request.ContentType;
                req.UserAgent = ctx.Request.UserAgent;

                // Copy auth headers
                string auth = ctx.Request.Headers["Authorization"];
                if (!string.IsNullOrEmpty(auth)) req.Headers["Authorization"] = auth;

                if (ctx.Request.HasEntityBody)
                {
                    using (Stream inStream = ctx.Request.InputStream)
                    using (Stream outStream = req.GetRequestStream())
                    {
                        inStream.CopyTo(outStream);
                    }
                }

                using (HttpWebResponse resp = (HttpWebResponse)req.GetResponse())
                {
                    ctx.Response.StatusCode = (int)resp.StatusCode;
                    ctx.Response.ContentType = resp.ContentType;
                    using (Stream respStream = resp.GetResponseStream())
                    {
                        respStream.CopyTo(ctx.Response.OutputStream);
                    }
                }
            }
            catch (WebException wex)
            {
                HttpWebResponse errResp = wex.Response as HttpWebResponse;
                if (errResp != null)
                {
                    ctx.Response.StatusCode = (int)errResp.StatusCode;
                    ctx.Response.ContentType = errResp.ContentType;
                    using (Stream errStream = errResp.GetResponseStream())
                    {
                        errStream.CopyTo(ctx.Response.OutputStream);
                    }
                }
                else
                {
                    ctx.Response.StatusCode = 502;
                    byte[] err = Encoding.UTF8.GetBytes("{\"message\":\"Backend not reachable\"}");
                    ctx.Response.ContentType = "application/json";
                    ctx.Response.OutputStream.Write(err, 0, err.Length);
                }
            }
        }

        static string GetMimeType(string ext)
        {
            switch (ext)
            {
                case ".html": return "text/html; charset=utf-8";
                case ".js": return "application/javascript; charset=utf-8";
                case ".css": return "text/css; charset=utf-8";
                case ".json": return "application/json";
                case ".svg": return "image/svg+xml";
                case ".png": return "image/png";
                case ".jpg":
                case ".jpeg": return "image/jpeg";
                case ".ico": return "image/x-icon";
                case ".webmanifest": return "application/manifest+json";
                case ".woff2": return "font/woff2";
                case ".woff": return "font/woff";
                case ".ttf": return "font/ttf";
                default: return "application/octet-stream";
            }
        }

        static Process LaunchAppBrowser(string url)
        {
            string[] possibleBrowsers = new string[]
            {
                Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.ProgramFilesX86), @"Microsoft\Edge\Application\msedge.exe"),
                Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.ProgramFiles), @"Microsoft\Edge\Application\msedge.exe"),
                Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData), @"Microsoft\Edge\Application\msedge.exe"),
                Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.ProgramFiles), @"Google\Chrome\Application\chrome.exe"),
                Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.ProgramFilesX86), @"Google\Chrome\Application\chrome.exe")
            };

            foreach (string exe in possibleBrowsers)
            {
                if (File.Exists(exe))
                {
                    string profileDir = Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData), "EarnVoiceApp", "Profile");
                    Directory.CreateDirectory(profileDir);

                    ProcessStartInfo psi = new ProcessStartInfo();
                    psi.FileName = exe;
                    psi.Arguments = string.Format("--app=\"{0}\" --window-size=1280,820 --user-data-dir=\"{1}\" --app-id=\"EarnVoiceApp\"", url, profileDir);
                    psi.UseShellExecute = false;
                    return Process.Start(psi);
                }
            }

            return null;
        }

        static void Cleanup()
        {
            _isRunning = false;
            try
            {
                if (_listener != null && _listener.IsListening)
                {
                    _listener.Stop();
                    _listener.Close();
                }
            }
            catch { }

            try
            {
                if (_phpProcess != null && !_phpProcess.HasExited)
                {
                    _phpProcess.Kill();
                }
            }
            catch { }
        }
    }
}
