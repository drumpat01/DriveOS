using System;
using System.Diagnostics;
using System.Drawing;
using System.IO;
using System.Net.Sockets;
using System.Reflection;
using System.Security.Cryptography;
using System.Text;
using System.Threading;
using System.Threading.Tasks;
using System.Windows.Forms;
using Microsoft.Web.WebView2.Core;
using Microsoft.Web.WebView2.WinForms;


[assembly: AssemblyTitle("DriveOS")]
[assembly: AssemblyProduct("DriveOS")]
[assembly: AssemblyDescription("Personal Vehicle Intelligence")]
[assembly: AssemblyVersion("3.2.0.0")]
[assembly: AssemblyFileVersion("3.2.0.0")]
[assembly: AssemblyInformationalVersion("3.2.0")]

namespace DriveOSDesktop
{
    internal static class Program
    {
        private static Mutex singleInstanceMutex;

        [STAThread]
        private static void Main()
        {
            bool createdNew;

            singleInstanceMutex = new Mutex(
                true,
                @"Local\DriveOS.Desktop.1.0",
                out createdNew
            );

            if (!createdNew)
            {
                MessageBox.Show(
                    "DriveOS is already running.",
                    "DriveOS",
                    MessageBoxButtons.OK,
                    MessageBoxIcon.Information
                );

                return;
            }

            try
            {
                Application.EnableVisualStyles();
                Application.SetCompatibleTextRenderingDefault(false);
                Application.Run(new DriveOSForm());
            }
            finally
            {
                try
                {
                    singleInstanceMutex.ReleaseMutex();
                }
                catch { }

                singleInstanceMutex.Dispose();
            }
        }
    }

    internal sealed class DriveOSForm : Form
    {
        private const int Port = 8787;
        private const string LocalHost = "127.0.0.1";
        private const string LocalUrl = "http://127.0.0.1:8787/";
        private const string LocalUrlFilter = "http://127.0.0.1:8787/*";

        private readonly WebView2 browser;
        private readonly string sessionToken;

        private Process backendProcess;
        private bool startupComplete;
        private bool shutdownStarted;

        public DriveOSForm()
        {
            sessionToken = CreateSessionToken();

            Text = "DriveOS 3.2";
            StartPosition = FormStartPosition.CenterScreen;
            MinimumSize = new Size(980, 680);
            ClientSize = new Size(1420, 900);
            BackColor = Color.FromArgb(248, 252, 254);
            Opacity = 0;

            string baseDir = AppDomain.CurrentDomain.BaseDirectory;
            string iconPath = Path.Combine(baseDir, "DriveOS-v4.ico");

            if (File.Exists(iconPath))
            {
                try
                {
                    Icon = new Icon(iconPath);
                }
                catch { }
            }

            browser = new WebView2();
            browser.Dock = DockStyle.Fill;
            browser.BackColor = BackColor;
            browser.DefaultBackgroundColor = BackColor;
            Controls.Add(browser);

            Shown += OnShown;
            FormClosing += OnFormClosing;
        }

        private static string CreateSessionToken()
        {
            byte[] bytes = new byte[32];

            using (RandomNumberGenerator rng = RandomNumberGenerator.Create())
            {
                rng.GetBytes(bytes);
            }

            StringBuilder builder = new StringBuilder(bytes.Length * 2);

            foreach (byte value in bytes)
            {
                builder.Append(value.ToString("x2"));
            }

            Array.Clear(bytes, 0, bytes.Length);
            return builder.ToString();
        }

        private async void OnShown(object sender, EventArgs e)
        {
            if (startupComplete)
            {
                return;
            }

            startupComplete = true;

            try
            {
                if (IsPortOpen(LocalHost, Port, 250))
                {
                    MessageBox.Show(
                        this,
                        "Local port 8787 is already in use.\r\n\r\n" +
                        "Close the other DriveOS instance or the application using that port and try again.",
                        "DriveOS",
                        MessageBoxButtons.OK,
                        MessageBoxIcon.Information
                    );

                    Close();
                    return;
                }

                if (!StartBackend())
                {
                    Close();
                    return;
                }

                bool ready = await WaitForBackendAsync(12000);

                if (!ready)
                {
                    string details = ReadBackendLog();

                    MessageBox.Show(
                        this,
                        "DriveOS could not start its local backend.\r\n\r\n" +
                        (String.IsNullOrWhiteSpace(details)
                            ? "No additional error details were recorded."
                            : details),
                        "DriveOS",
                        MessageBoxButtons.OK,
                        MessageBoxIcon.Error
                    );

                    Close();
                    return;
                }

                string baseDir = AppDomain.CurrentDomain.BaseDirectory;
                string profileDir = Path.Combine(baseDir, "data", "webview2-profile-3.2.0");
                Directory.CreateDirectory(profileDir);

                CoreWebView2Environment environment =
                    await CoreWebView2Environment.CreateAsync(null, profileDir);

                await browser.EnsureCoreWebView2Async(environment);

                // Keep the embedded browser surface intentionally narrow.
                browser.CoreWebView2.Settings.AreDevToolsEnabled = false;
                browser.CoreWebView2.Settings.AreDefaultContextMenusEnabled = false;
                browser.CoreWebView2.Settings.IsStatusBarEnabled = false;
                browser.CoreWebView2.Settings.AreBrowserAcceleratorKeysEnabled = false;
                browser.CoreWebView2.Settings.IsWebMessageEnabled = false;
                browser.CoreWebView2.Settings.AreHostObjectsAllowed = false;

                // Every request to the localhost backend gets an ephemeral
                // 256-bit session credential. It never appears in the DOM,
                // JavaScript source, URL, disk cache, or persistent settings.
                browser.CoreWebView2.AddWebResourceRequestedFilter(
                    LocalUrlFilter,
                    CoreWebView2WebResourceContext.All
                );

                browser.CoreWebView2.WebResourceRequested += OnWebResourceRequested;
                browser.CoreWebView2.NewWindowRequested += OnNewWindowRequested;
                browser.CoreWebView2.NavigationStarting += OnNavigationStarting;
                browser.CoreWebView2.NavigationCompleted += OnNavigationCompleted;
                browser.CoreWebView2.PermissionRequested += OnPermissionRequested;
                browser.CoreWebView2.DownloadStarting += OnDownloadStarting;
                browser.CoreWebView2.ServerCertificateErrorDetected += OnServerCertificateErrorDetected;

                browser.Source = new Uri(LocalUrl);
            }
            catch (WebView2RuntimeNotFoundException)
            {
                MessageBox.Show(
                    this,
                    "Microsoft Edge WebView2 Runtime is not installed on this computer.\r\n\r\n" +
                    "DriveOS needs the WebView2 Runtime to display its interface.",
                    "DriveOS",
                    MessageBoxButtons.OK,
                    MessageBoxIcon.Error
                );

                Close();
            }
            catch (Exception ex)
            {
                MessageBox.Show(
                    this,
                    "DriveOS could not open.\r\n\r\n" + ex.Message,
                    "DriveOS",
                    MessageBoxButtons.OK,
                    MessageBoxIcon.Error
                );

                Close();
            }
        }

        private bool StartBackend()
        {
            string baseDir = AppDomain.CurrentDomain.BaseDirectory;
            string secretFile = Path.Combine(baseDir, "data", "driveos-secrets.json");
            string backendScript = Path.Combine(baseDir, "DriveOS-Backend.ps1");

            if (!File.Exists(secretFile))
            {
                MessageBox.Show(
                    this,
                    "DriveOS encrypted secrets have not been set up yet.\r\n\r\n" +
                    "Run SETUP-DRIVEOS-SECRETS.bat once, then open DriveOS again.",
                    "DriveOS",
                    MessageBoxButtons.OK,
                    MessageBoxIcon.Warning
                );

                return false;
            }

            if (!File.Exists(backendScript))
            {
                MessageBox.Show(
                    this,
                    "DriveOS-Backend.ps1 is missing from the DriveOS folder.",
                    "DriveOS",
                    MessageBoxButtons.OK,
                    MessageBoxIcon.Error
                );

                return false;
            }

            Process current = Process.GetCurrentProcess();

            ProcessStartInfo psi = new ProcessStartInfo();
            psi.FileName = "powershell.exe";
            psi.Arguments =
                "-NoProfile -NonInteractive -ExecutionPolicy Bypass -WindowStyle Hidden -File \"" +
                backendScript +
                "\" -ParentPid " +
                current.Id.ToString();
            psi.WorkingDirectory = baseDir;
            psi.UseShellExecute = false;
            psi.CreateNoWindow = true;
            psi.WindowStyle = ProcessWindowStyle.Hidden;

            // Pass the ephemeral local-session credential through the child
            // environment rather than through the command line.
            psi.EnvironmentVariables["DRIVEOS_SESSION_TOKEN"] = sessionToken;
            psi.EnvironmentVariables["DRIVEOS_PARENT_START_TICKS"] =
                current.StartTime.ToUniversalTime().Ticks.ToString();

            backendProcess = Process.Start(psi);
            return backendProcess != null;
        }

        private async Task<bool> WaitForBackendAsync(int timeoutMilliseconds)
        {
            int waited = 0;

            while (waited < timeoutMilliseconds)
            {
                if (backendProcess != null && backendProcess.HasExited)
                {
                    return false;
                }

                if (IsPortOpen(LocalHost, Port, 200))
                {
                    return true;
                }

                await Task.Delay(200);
                waited += 200;
            }

            return false;
        }

        private static bool IsPortOpen(string host, int port, int timeoutMilliseconds)
        {
            TcpClient client = null;

            try
            {
                client = new TcpClient();
                IAsyncResult result = client.BeginConnect(host, port, null, null);
                bool success = result.AsyncWaitHandle.WaitOne(timeoutMilliseconds);

                if (!success)
                {
                    return false;
                }

                client.EndConnect(result);
                return true;
            }
            catch
            {
                return false;
            }
            finally
            {
                if (client != null)
                {
                    try { client.Close(); } catch { }
                }
            }
        }

        private void OnWebResourceRequested(
            object sender,
            CoreWebView2WebResourceRequestedEventArgs e)
        {
            Uri uri;

            if (!Uri.TryCreate(e.Request.Uri, UriKind.Absolute, out uri))
            {
                return;
            }

            if (!IsLocalDriveOSUri(uri))
            {
                return;
            }

            e.Request.Headers.SetHeader("X-DriveOS-Session", sessionToken);
        }

        private void OnNewWindowRequested(
            object sender,
            CoreWebView2NewWindowRequestedEventArgs e)
        {
            e.Handled = true;

            Uri uri;

            if (!Uri.TryCreate(e.Uri, UriKind.Absolute, out uri))
            {
                return;
            }

            if (IsLocalDriveOSUri(uri))
            {
                browser.CoreWebView2.Navigate(uri.AbsoluteUri);
                return;
            }

            if (IsApprovedExternalUri(uri))
            {
                OpenExternal(uri.AbsoluteUri);
            }
        }

        private async void OnNavigationCompleted(
            object sender,
            CoreWebView2NavigationCompletedEventArgs e)
        {
            // The WinForms window stays completely invisible while the backend,
            // WebView2 runtime, HTML, CSS, logo assets, and JavaScript initialize.
            // Once the local DriveOS page is fully loaded, start Ignition first,
            // then reveal the native window. This prevents a dark/blank WebView
            // frame from ever being shown to the user.
            if (!e.IsSuccess)
            {
                return;
            }

            try
            {
                Uri source = browser.Source;

                if (source == null ||
                    !String.Equals(source.Scheme, "http", StringComparison.OrdinalIgnoreCase) ||
                    !String.Equals(source.Host, LocalHost, StringComparison.OrdinalIgnoreCase) ||
                    source.Port != Port)
                {
                    return;
                }

                await browser.ExecuteScriptAsync(
                    "if (typeof runDriveOSIgnition === 'function') { runDriveOSIgnition(); }"
                );

                // Reveal only after the ignition overlay is already active.
                Opacity = 1;
                Activate();
                browser.Focus();
            }
            catch
            {
                // If the launch animation itself ever fails, reveal the app rather
                // than leaving DriveOS permanently invisible.
                Opacity = 1;
            }
        }

        private void OnNavigationStarting(
            object sender,
            CoreWebView2NavigationStartingEventArgs e)
        {
            if (String.Equals(
                    e.Uri,
                    "about:blank",
                    StringComparison.OrdinalIgnoreCase))
            {
                return;
            }

            Uri uri;

            if (!Uri.TryCreate(e.Uri, UriKind.Absolute, out uri))
            {
                e.Cancel = true;
                return;
            }

            if (IsLocalDriveOSUri(uri))
            {
                return;
            }

            e.Cancel = true;

            if (IsApprovedExternalUri(uri))
            {
                OpenExternal(uri.AbsoluteUri);
            }
        }

        private static void OnPermissionRequested(
            object sender,
            CoreWebView2PermissionRequestedEventArgs e)
        {
            // DriveOS does not need camera, microphone, location, MIDI,
            // clipboard, notifications, or other browser permissions.
            e.State = CoreWebView2PermissionState.Deny;
        }

        private static void OnDownloadStarting(
            object sender,
            CoreWebView2DownloadStartingEventArgs e)
        {
            // DriveOS has no in-app download workflow.
            e.Cancel = true;
        }

        private static void OnServerCertificateErrorDetected(
            object sender,
            CoreWebView2ServerCertificateErrorDetectedEventArgs e)
        {
            // Never continue through TLS certificate errors for map,
            // Spotify artwork, or any other network resource.
            e.Action = CoreWebView2ServerCertificateErrorAction.Cancel;
        }

        private static bool IsLocalDriveOSUri(Uri uri)
        {
            return
                uri != null &&
                String.Equals(uri.Scheme, "http", StringComparison.OrdinalIgnoreCase) &&
                String.Equals(uri.Host, LocalHost, StringComparison.OrdinalIgnoreCase) &&
                uri.Port == Port;
        }

        private static bool IsApprovedExternalUri(Uri uri)
        {
            if (uri == null ||
                !String.Equals(uri.Scheme, "https", StringComparison.OrdinalIgnoreCase))
            {
                return false;
            }

            string host = uri.Host.ToLowerInvariant();

            return
                host == "open.spotify.com" ||
                host == "spotify.com" ||
                host.EndsWith(".spotify.com", StringComparison.Ordinal) ||
                host == "x.com" ||
                host.EndsWith(".x.com", StringComparison.Ordinal);
        }

        private static void OpenExternal(string uri)
        {
            try
            {
                ProcessStartInfo psi = new ProcessStartInfo();
                psi.FileName = uri;
                psi.UseShellExecute = true;
                Process.Start(psi);
            }
            catch { }
        }

        private string ReadBackendLog()
        {
            try
            {
                string logPath = Path.Combine(
                    AppDomain.CurrentDomain.BaseDirectory,
                    "data",
                    "driveos-backend.log"
                );

                if (!File.Exists(logPath))
                {
                    return "";
                }

                string text = File.ReadAllText(logPath).Trim();

                if (text.Length > 1800)
                {
                    text = text.Substring(text.Length - 1800);
                }

                return text;
            }
            catch
            {
                return "";
            }
        }

        private void OnFormClosing(object sender, FormClosingEventArgs e)
        {
            ShutdownBackend();
        }

        private void ShutdownBackend()
        {
            if (shutdownStarted)
            {
                return;
            }

            shutdownStarted = true;

            try
            {
                if (browser != null)
                {
                    browser.Dispose();
                }
            }
            catch { }

            try
            {
                if (backendProcess != null && !backendProcess.HasExited)
                {
                    backendProcess.Kill();

                    try
                    {
                        backendProcess.WaitForExit(2000);
                    }
                    catch { }
                }
            }
            catch { }
            finally
            {
                if (backendProcess != null)
                {
                    backendProcess.Dispose();
                    backendProcess = null;
                }
            }
        }
    }
}
