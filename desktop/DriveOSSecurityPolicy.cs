using System;
using System.Security.Cryptography;
using System.Text;
using Microsoft.Web.WebView2.Core;

namespace DriveOSDesktop
{
    internal static class DriveOSSecurityPolicy
    {
        internal const int Port = 8787;
        internal const string LocalHost = "127.0.0.1";
        internal const string LocalUrl = "http://127.0.0.1:8787/";
        internal const string LocalUrlFilter = "http://127.0.0.1:8787/*";

        internal static string CreateSessionToken()
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

        internal static void Configure(CoreWebView2 webView)
        {
            webView.Settings.AreDevToolsEnabled = false;
            webView.Settings.AreDefaultContextMenusEnabled = false;
            webView.Settings.IsStatusBarEnabled = false;
            webView.Settings.AreBrowserAcceleratorKeysEnabled = false;
            webView.Settings.IsWebMessageEnabled = false;
            webView.Settings.AreHostObjectsAllowed = false;
        }

        internal static bool IsLocalUri(Uri uri)
        {
            return uri != null &&
                String.Equals(uri.Scheme, "http", StringComparison.OrdinalIgnoreCase) &&
                String.Equals(uri.Host, LocalHost, StringComparison.OrdinalIgnoreCase) &&
                uri.Port == Port;
        }

        internal static bool IsApprovedExternalUri(Uri uri)
        {
            if (uri == null ||
                !String.Equals(uri.Scheme, "https", StringComparison.OrdinalIgnoreCase))
            {
                return false;
            }

            string host = uri.Host.ToLowerInvariant();

            return host == "open.spotify.com" ||
                host == "spotify.com" ||
                host.EndsWith(".spotify.com", StringComparison.Ordinal) ||
                host == "x.com" ||
                host.EndsWith(".x.com", StringComparison.Ordinal);
        }
    }
}
