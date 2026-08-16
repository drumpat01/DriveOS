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


[assembly: AssemblyTitle("JourneyDeck")]
[assembly: AssemblyProduct("JourneyDeck")]
[assembly: AssemblyDescription("Personal Vehicle Intelligence")]
[assembly: AssemblyVersion("5.9.4.0")]
[assembly: AssemblyFileVersion("5.9.4.0")]
[assembly: AssemblyInformationalVersion("5.9.4")]

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
                    "JourneyDeck is already running.",
                    "JourneyDeck",
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
        private readonly WebView2 browser;
        private readonly string sessionToken;
        private readonly DriveOSBackendHost backendHost;
        private bool startupComplete;
        private bool shutdownStarted;
        private bool mobilePreviewActive;
        private Rectangle desktopBounds;
        private FormWindowState desktopWindowState;

        public DriveOSForm()
        {
            sessionToken = DriveOSSecurityPolicy.CreateSessionToken();
            backendHost = new DriveOSBackendHost();

            Text = "JourneyDeck 5.9";
            StartPosition = FormStartPosition.CenterScreen;
            MinimumSize = new Size(390, 680);
            ClientSize = new Size(1420, 900);
            BackColor = Color.FromArgb(248, 252, 254);
            Opacity = 0;
            KeyPreview = true;

            string baseDir = AppDomain.CurrentDomain.BaseDirectory;
            string iconPath = Path.Combine(baseDir, "JourneyDeck.ico");

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
            KeyDown += OnWindowKeyDown;
            browser.KeyDown += OnWindowKeyDown;
            FormClosing += OnFormClosing;
        }

        private void EnterMobilePreview(object sender, EventArgs e)
        {
            if (mobilePreviewActive)
            {
                return;
            }

            desktopWindowState = WindowState;
            if (WindowState == FormWindowState.Normal)
            {
                desktopBounds = Bounds;
            }
            else
            {
                desktopBounds = RestoreBounds;
            }

            mobilePreviewActive = true;
            WindowState = FormWindowState.Normal;

            Rectangle workingArea = Screen.FromControl(this).WorkingArea;
            int previewHeight = Math.Min(860, workingArea.Height - 32);
            ClientSize = new Size(430, Math.Max(680, previewHeight));
            Location = new Point(
                workingArea.Left + Math.Max(0, (workingArea.Width - Width) / 2),
                workingArea.Top + Math.Max(0, (workingArea.Height - Height) / 2)
            );

            Text = "JourneyDeck 5.3 - Mobile Preview (Esc to exit)";
            browser.Focus();
        }

        private void ExitMobilePreview()
        {
            if (!mobilePreviewActive)
            {
                return;
            }

            mobilePreviewActive = false;
            WindowState = FormWindowState.Normal;
            Bounds = desktopBounds;
            if (desktopWindowState == FormWindowState.Maximized)
            {
                WindowState = FormWindowState.Maximized;
            }

            Text = "JourneyDeck 5.9";
            if (browser.CoreWebView2 != null)
            {
                browser.CoreWebView2.ExecuteScriptAsync("window.scrollTo({ top: 0, behavior: 'instant' });");
            }
            browser.Focus();
        }

        private void OnWindowKeyDown(object sender, KeyEventArgs e)
        {
            if (mobilePreviewActive &&
                (e.KeyCode == Keys.Escape ||
                 (e.Control && e.Shift && e.KeyCode == Keys.M)))
            {
                ExitMobilePreview();
                e.Handled = true;
                e.SuppressKeyPress = true;
            }
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
                if (backendHost.IsPortInUse(250))
                {
                    MessageBox.Show(
                        this,
                        "Local port 8787 is already in use.\r\n\r\n" +
                        "Close the other JourneyDeck instance or the application using that port and try again.",
                        "JourneyDeck",
                        MessageBoxButtons.OK,
                        MessageBoxIcon.Information
                    );

                    Close();
                    return;
                }

                string installationError = backendHost.ValidateInstallation();

                if (!String.IsNullOrEmpty(installationError))
                {
                    MessageBox.Show(this, installationError, "JourneyDeck", MessageBoxButtons.OK,
                        installationError.IndexOf("secrets", StringComparison.OrdinalIgnoreCase) >= 0
                            ? MessageBoxIcon.Warning
                            : MessageBoxIcon.Error);
                    Close();
                    return;
                }

                if (!backendHost.Start(sessionToken))
                {
                    Close();
                    return;
                }

                bool ready = await backendHost.WaitUntilReadyAsync(12000);

                if (!ready)
                {
                    string details = backendHost.ReadLog();

                    MessageBox.Show(
                        this,
                        "JourneyDeck could not start its local backend.\r\n\r\n" +
                        (String.IsNullOrWhiteSpace(details)
                            ? "No additional error details were recorded."
                            : details),
                        "JourneyDeck",
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
                DriveOSSecurityPolicy.Configure(browser.CoreWebView2);

                // Every request to the localhost backend gets an ephemeral
                // 256-bit session credential. It never appears in the DOM,
                // JavaScript source, URL, disk cache, or persistent settings.
                browser.CoreWebView2.AddWebResourceRequestedFilter(
                    DriveOSSecurityPolicy.LocalUrlFilter,
                    CoreWebView2WebResourceContext.All
                );

                browser.CoreWebView2.WebResourceRequested += OnWebResourceRequested;
                browser.CoreWebView2.NewWindowRequested += OnNewWindowRequested;
                browser.CoreWebView2.NavigationStarting += OnNavigationStarting;
                browser.CoreWebView2.NavigationCompleted += OnNavigationCompleted;
                browser.CoreWebView2.WebMessageReceived += OnWebMessageReceived;
                browser.CoreWebView2.PermissionRequested += OnPermissionRequested;
                browser.CoreWebView2.DownloadStarting += OnDownloadStarting;
                browser.CoreWebView2.ServerCertificateErrorDetected += OnServerCertificateErrorDetected;

                browser.Source = new Uri(DriveOSSecurityPolicy.LocalUrl);
            }
            catch (WebView2RuntimeNotFoundException)
            {
                MessageBox.Show(
                    this,
                    "Microsoft Edge WebView2 Runtime is not installed on this computer.\r\n\r\n" +
                    "JourneyDeck needs the WebView2 Runtime to display its interface.",
                    "JourneyDeck",
                    MessageBoxButtons.OK,
                    MessageBoxIcon.Error
                );

                Close();
            }
            catch (Exception ex)
            {
                MessageBox.Show(
                    this,
                    "JourneyDeck could not open.\r\n\r\n" + ex.Message,
                    "JourneyDeck",
                    MessageBoxButtons.OK,
                    MessageBoxIcon.Error
                );

                Close();
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

            if (!DriveOSSecurityPolicy.IsLocalUri(uri))
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

            if (DriveOSSecurityPolicy.IsLocalUri(uri))
            {
                browser.CoreWebView2.Navigate(uri.AbsoluteUri);
                return;
            }

            if (DriveOSSecurityPolicy.IsApprovedExternalUri(uri))
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
                    !String.Equals(source.Host, DriveOSSecurityPolicy.LocalHost, StringComparison.OrdinalIgnoreCase) ||
                    source.Port != DriveOSSecurityPolicy.Port)
                {
                    return;
                }

                await browser.ExecuteScriptAsync(
                    "if (typeof runDriveOSIgnition === 'function') { runDriveOSIgnition(); }"
                );

                await browser.ExecuteScriptAsync(
                    "const previewButton=document.getElementById('desktopMobilePreviewButton');" +
                    "if(previewButton){previewButton.hidden=false;previewButton.onclick=()=>window.chrome.webview.postMessage('journeydeck:mobile-preview');}" +
                    "const wifePreviewButton=document.getElementById('desktopWifePreviewButton');" +
                    "if(wifePreviewButton){wifePreviewButton.hidden=false;wifePreviewButton.onclick=()=>window.chrome.webview.postMessage('journeydeck:wife-preview');}"
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

        private void OnWebMessageReceived(
            object sender,
            CoreWebView2WebMessageReceivedEventArgs e)
        {
            try
            {
                Uri source;
                if (!Uri.TryCreate(e.Source, UriKind.Absolute, out source) ||
                    !DriveOSSecurityPolicy.IsLocalUri(source))
                {
                    return;
                }

                string message = e.TryGetWebMessageAsString();
                if (String.Equals(
                    message,
                    "journeydeck:mobile-preview",
                    StringComparison.Ordinal))
                {
                    EnterMobilePreview(this, EventArgs.Empty);
                }
                else if (String.Equals(
                    message,
                    "journeydeck:wife-preview",
                    StringComparison.Ordinal))
                {
                    browser.CoreWebView2.Navigate(DriveOSSecurityPolicy.LocalUrl + "wife");
                }
            }
            catch { }
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

            if (DriveOSSecurityPolicy.IsLocalUri(uri))
            {
                return;
            }

            e.Cancel = true;

            if (DriveOSSecurityPolicy.IsApprovedExternalUri(uri))
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
            CoreWebView2DownloadOperation download = e.DownloadOperation;
            string uri = download == null ? string.Empty : download.Uri;
            string mimeType = download == null ? string.Empty : download.MimeType;
            string suggestedName = Path.GetFileName(e.ResultFilePath ?? string.Empty);

            // Share cards are created by DriveOS as blob-backed PNGs. Keep every
            // other download blocked so external content cannot write local files.
            bool isDriveOSShareCard =
                uri.StartsWith("blob:" + DriveOSSecurityPolicy.LocalUrl, StringComparison.OrdinalIgnoreCase) &&
                string.Equals(mimeType, "image/png", StringComparison.OrdinalIgnoreCase) &&
                suggestedName.StartsWith("driveos-", StringComparison.OrdinalIgnoreCase) &&
                suggestedName.EndsWith(".png", StringComparison.OrdinalIgnoreCase);

            if (!isDriveOSShareCard)
            {
                e.Cancel = true;
                return;
            }

            using (SaveFileDialog dialog = new SaveFileDialog())
            {
                dialog.Title = "Save JourneyDeck share card";
                dialog.Filter = "PNG image (*.png)|*.png";
                dialog.DefaultExt = "png";
                dialog.AddExtension = true;
                dialog.FileName = suggestedName;
                dialog.InitialDirectory = Environment.GetFolderPath(
                    Environment.SpecialFolder.MyPictures
                );

                if (dialog.ShowDialog() != DialogResult.OK)
                {
                    e.Cancel = true;
                    return;
                }

                e.ResultFilePath = Path.GetFullPath(dialog.FileName);
                e.Handled = true;
                e.Cancel = false;
            }
        }

        private static void OnServerCertificateErrorDetected(
            object sender,
            CoreWebView2ServerCertificateErrorDetectedEventArgs e)
        {
            // Never continue through TLS certificate errors for map,
            // Spotify artwork, or any other network resource.
            e.Action = CoreWebView2ServerCertificateErrorAction.Cancel;
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

        private void OnFormClosing(object sender, FormClosingEventArgs e)
        {
            ShutdownBackend();

            // WebView2 can stall while WinForms disposes the closing form and
            // leave this otherwise invisible process alive. The backend is
            // already stopped, so finish the desktop process immediately.
            Environment.Exit(0);
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
                // Never allow backend-process cleanup to pin the WinForms UI
                // thread indefinitely. The server also watches this process
                // and exits automatically if this bounded cleanup times out.
                Task.Run(() => backendHost.Dispose()).Wait(2500);
            }
            catch { }
        }
    }
}
