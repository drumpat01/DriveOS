using System;
using System.Diagnostics;
using System.IO;
using System.Net.Sockets;
using System.Threading.Tasks;

namespace DriveOSDesktop
{
    internal sealed class DriveOSBackendHost : IDisposable
    {
        private Process process;
        private bool shutdownStarted;

        internal bool IsPortInUse(int timeoutMilliseconds)
        {
            return IsPortOpen(
                DriveOSSecurityPolicy.LocalHost,
                DriveOSSecurityPolicy.Port,
                timeoutMilliseconds
            );
        }

        internal string ValidateInstallation()
        {
            string baseDir = AppDomain.CurrentDomain.BaseDirectory;

            if (!File.Exists(Path.Combine(baseDir, "data", "driveos-secrets.json")))
            {
                return "JourneyDeck encrypted secrets have not been set up yet.\r\n\r\n" +
                    "Run SETUP-DRIVEOS-SECRETS.bat once, then open JourneyDeck again.";
            }

            if (!File.Exists(Path.Combine(baseDir, "DriveOS-Backend.ps1")))
            {
                return "DriveOS-Backend.ps1 is missing from the JourneyDeck installation folder.";
            }

            return "";
        }

        internal bool Start(string sessionToken)
        {
            string baseDir = AppDomain.CurrentDomain.BaseDirectory;
            string backendScript = Path.Combine(baseDir, "DriveOS-Backend.ps1");
            Process current = Process.GetCurrentProcess();

            ProcessStartInfo startInfo = new ProcessStartInfo();
            startInfo.FileName = "powershell.exe";
            startInfo.Arguments =
                "-NoProfile -NonInteractive -ExecutionPolicy Bypass -WindowStyle Hidden -File \"" +
                backendScript + "\" -ParentPid " + current.Id.ToString();
            startInfo.WorkingDirectory = baseDir;
            startInfo.UseShellExecute = false;
            startInfo.CreateNoWindow = true;
            startInfo.WindowStyle = ProcessWindowStyle.Hidden;
            startInfo.EnvironmentVariables["DRIVEOS_SESSION_TOKEN"] = sessionToken;
            startInfo.EnvironmentVariables["DRIVEOS_PARENT_START_TICKS"] =
                current.StartTime.ToUniversalTime().Ticks.ToString();

            process = Process.Start(startInfo);
            return process != null;
        }

        internal async Task<bool> WaitUntilReadyAsync(int timeoutMilliseconds)
        {
            int waited = 0;

            while (waited < timeoutMilliseconds)
            {
                if (process != null && process.HasExited)
                {
                    return false;
                }

                if (IsPortInUse(200))
                {
                    return true;
                }

                await Task.Delay(200);
                waited += 200;
            }

            return false;
        }

        internal string ReadLog()
        {
            try
            {
                string path = Path.Combine(
                    AppDomain.CurrentDomain.BaseDirectory,
                    "data",
                    "driveos-backend.log"
                );

                if (!File.Exists(path))
                {
                    return "";
                }

                string text = File.ReadAllText(path).Trim();
                return text.Length > 1800 ? text.Substring(text.Length - 1800) : text;
            }
            catch
            {
                return "";
            }
        }

        public void Dispose()
        {
            if (shutdownStarted)
            {
                return;
            }

            shutdownStarted = true;

            try
            {
                if (process != null && !process.HasExited)
                {
                    process.Kill();
                    try { process.WaitForExit(2000); } catch { }
                }
            }
            catch { }
            finally
            {
                if (process != null)
                {
                    process.Dispose();
                    process = null;
                }
            }
        }

        private static bool IsPortOpen(string host, int port, int timeoutMilliseconds)
        {
            TcpClient client = null;

            try
            {
                client = new TcpClient();
                IAsyncResult result = client.BeginConnect(host, port, null, null);

                if (!result.AsyncWaitHandle.WaitOne(timeoutMilliseconds))
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
    }
}
