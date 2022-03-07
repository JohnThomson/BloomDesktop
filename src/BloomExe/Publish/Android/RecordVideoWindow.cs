using System;
using System.Collections.Generic;
using System.ComponentModel;
using System.Data;
using System.Diagnostics;
using System.Drawing;
using System.IO;
using System.Linq;
using System.Runtime.InteropServices;
using System.Text;
using System.Threading.Tasks;
using System.Windows.Forms;
using Bloom.Api;
using Bloom.Utils;
using L10NSharp;
using SIL.IO;

namespace Bloom.Publish.Android
{
	public partial class RecordVideoWindow : Form
	{
		private Browser _content;
		private Process _ffmpegProcess;
		private StringBuilder _errorData;
		private DateTime _startTime;
		private string _bookFolder;
		private string _videoOnlyPath;
		private string _ffmpegPath;
		private TempFile _initialVideo;
		private TempFile _finalVideo;
		private bool _recording = true;
		private bool _saveReceived = false;
		private string _pathToRealBook;
		private BloomWebSocketServer _webSocketServer;
		private int _videoHeight = 720; // default, facebook
		private int _videoWidth = 1280;
		private string codec = "h.264";
		private string _pageReadTime = "3.0"; // default for pages without narration
		private string _videoSettingsFromPreview;

		public RecordVideoWindow(BloomWebSocketServer webSocketServer)
		{
			InitializeComponent();
			_webSocketServer = webSocketServer;
			_content = new Browser();
			_content.Dock = DockStyle.Fill;
			Controls.Add(_content);
		}

		public void Show(string bookUrl, string pathToRealBook)
		{
			_bookFolder = Path.GetDirectoryName(bookUrl.FromLocalhost());
			_pathToRealBook = pathToRealBook;
			var readTime = (codec == "mp3" ? "0" : _pageReadTime);
			var url = BloomServer.ServerUrlWithBloomPrefixEndingInSlash
			          + "bloom-player/dist/bloomplayer.htm?centerVertically=true&reportSoundLog=true&initiallyShowAppBar=false&autoplay=yes&hideNavButtons=true&url="
			          + bookUrl
			          + $"&independent=false&host=bloomdesktop&defaultDuration={readTime}&skipActivities=true";
			if (_videoSettingsFromPreview != null)
			{
				url += $"&videoSettings={_videoSettingsFromPreview}";
			}

			_content.Navigate(url, false);
			var deltaV = this.Height - _content.Height;
			var deltaH = this.Width - _content.Width;
			// We may need to make it bigger than the screen
			MaximumSize = new Size(3000, 3000);
			Height = _videoHeight + deltaV;
			Width = _videoWidth + deltaH;
			var mainWindow = Application.OpenForms.Cast<Form>().FirstOrDefault(f => f is Shell);
			if (mainWindow != null)
			{
				StartPosition = FormStartPosition.Manual;
				var bounds = Screen.FromControl(mainWindow).Bounds;
				Location = bounds.Location;
			}

			Show(mainWindow);
		}

		protected override void OnLoad(EventArgs e)
		{
			base.OnLoad(e);
			_webSocketServer.SendString("recordVideo", "ready", "false");
			_initialVideo = TempFile.WithExtension(".mp4");
			_videoOnlyPath = _initialVideo.Path;
			RobustFile.Delete(_videoOnlyPath);
		}

		public void StartFfmpeg()
		{
			// We do these steps unconditionally because they are used later when we run
			// ffmpeg (for the second time, if recording video).
			_errorData = new StringBuilder();
			_ffmpegPath = MiscUtils.FindFfmpegProgram();
			// Enhance: what on earth should we do if it's not found??
			if (codec == "mp3")
			{
				_startTime = DateTime.Now;
				return; // no need to actually make a video.
			}
			

			var args =
				//"-t 10 " // duration limit"
				"-f gdigrab " // basic command for using a windows window as a video input stream
				+ "-framerate 30 " // frames per second to capture (30fps is standard for SD video)
				+ "-draw_mouse 0 " // don't capture any mouse movement over the window
				+ $"-i title={Text} " // identifies the window for gdigrab
				// lbx164 is the standard encoder for H.264, which Wickipedia says is the most used (91%)
				// video compression format. ffmpeg will use H.264 by default, but I think we have to
				// specify the encoder in order to give it parameters. H.264 has a variety of 'profiles',
				// and the one used by default, which I think may be High 4:4:4, is not widely supported.
				// For example, it won't open on Windows with Media Player, Movies and TV, Photos, or
				// Windows Media Player, nor in Firefox, nor in either of the apps suggested for mp4 files
				// on my Android 11 device. The 'main' profile specified here seems to be
				// much better, and opened in everything I tried. However, by default 'main' tries to use
				// 4:4:4 and gives an error message. Some pix_fmt seems to be needed, and this one works
				// in all the above places, though I'm not clear exactly what it does.
				// To sum up, this substring, which needs to come after the inputs and before the output,
				// tells it to make an H.264 compressed video of a type (profile) that most software can work with.
				+ "-c:v libx264 -profile:v main -pix_fmt yuv420p "
				+ _videoOnlyPath;
			_ffmpegProcess = new Process
			{
				StartInfo =
				{
					FileName = _ffmpegPath,
					Arguments = args,
					UseShellExecute = false, // enables CreateNoWindow
					CreateNoWindow = true, // don't need a DOS box
					RedirectStandardOutput = true,
					RedirectStandardError = true,
					RedirectStandardInput = true,
				}
			};
			Debug.WriteLine("args: " + args);
			_ffmpegProcess.ErrorDataReceived += (o, receivedEventArgs) =>
			{
				_errorData.AppendLine(receivedEventArgs.Data);
			};
			_ffmpegProcess.Start();
			_startTime = DateTime.Now;
			// Nothing seems to come over the output stream, but it seems to be important to
			// have something running that will accept input on these streams, otherwise the 'q'
			// that we send on standard input is not received. A comment I saw elsewhere indicated
			// that a deadlock in ffmpeg might be involved.
			_ffmpegProcess.BeginOutputReadLine();
			_ffmpegProcess.BeginErrorReadLine();
		}

		string UrlToFile(string input)
		{
			var result = input.FromLocalhost();
			// If we added a param to force reloading, remove it.
			var index = result.IndexOf("?");
			if (index >= 0)
				result = result.Substring(0, index);
			return result;
		}

		public void StopRecording(string soundLogJson)
		{
			var haveVideo = codec != "mp3";
			if (haveVideo)
			{
				Debug.WriteLine("Telling ffmpeg to quit");
				_ffmpegProcess.StandardInput.WriteLine("q");
				_ffmpegProcess.WaitForExit();
				Debug.WriteLine("full error log: " + _errorData.ToString());
			}

			Debug.WriteLine(soundLogJson);
			var soundLogObj = DynamicJson.Parse(soundLogJson);

			//var soundLog = soundLogObj.Deserialize<SoundLogItem[]>(); // doesn't work, don't know why.
			int count = soundLogObj.Count;

			var soundLog = new SoundLogItem[count];
			for (int i = 0; i < count; i++)
			{
				var item = soundLogObj[i];
				var sound = new SoundLogItem()
				{
					src = UrlToFile((string)item.src),
					volume = item.volume,
					startTime = DateTime.Parse(item.startTime)
				};
				if (item.IsDefined("endTime"))
				{
					sound.endTime = DateTime.Parse(item.endTime);
				}

				sound.startOffset = sound.startTime - _startTime;

				soundLog[i] = sound;
			}

			_finalVideo = TempFile.WithExtension(haveVideo ? ".mp4" : ".mp3");
			var finalOutputPath = _finalVideo.Path;
			RobustFile.Delete(finalOutputPath);
			if (soundLog.Length == 0)
			{
				if (!haveVideo)
					return; // can't do anything useful!
				RobustFile.Copy(_videoOnlyPath, finalOutputPath);
				return;
			}

			var inputs = string.Join(" ", soundLog.Select(item => $"-i \"{item.src}\" "));

			var mixArgs = string.Join(" ", soundLog.Select((item, index) =>
			{
				var result = $"[{index}:a]";
				if (item.endTime != default(DateTime))
				{
					var duration = (item.endTime - item.startTime);


					result += $"atrim=end={duration.TotalSeconds},";
				}

				var delay = item.startTime - _startTime;
				// all=1: in case the input is stereo, all channels of it will be delayed.
				// We shouldn't get negative delays, since startTime
				// is recorded during a method that completes before we return
				Debug.Assert(delay.TotalMilliseconds >= 0);
				result += $"adelay={Math.Max(delay.TotalMilliseconds, 0)}:all=1";

				if (item.volume != 1.0)
				{
					result += $",volume={item.volume}";
				}

				result += $"[a{index}]; ";
				return result;
			}));

			var mixInputs = string.Join("", soundLog.Select((item, index) => $"[a{index}]"));
			var videoIndex = soundLog.Length;

			var args = ""
			           + inputs // the audio files are inputs, which may be referred to as [1:a], [2:a], etc.
			           + (haveVideo ? $"-i \"{_videoOnlyPath}\" " : "") // last input (videoIndex) is the original video (if any)
			           + "-filter_complex \""// the next bit specifies a filter with multiple inputs
			           + mixArgs // specifies the inputs to the mixer
			           // mix those inputs to a single stream called out
			           + mixInputs + $"amix=inputs={soundLog.Length}:normalize=0[out]\" "
			           + (haveVideo ? $"-map {videoIndex}:v -c:v copy " : "") // copy the video channel (of input videoIndex) unchanged (if we have video).
			           // Shouldwe wpecify MP3 for the SoundHandler instead of the default AAC?
			           // https://www.movavi.com/learning-portal/aac-vs-mp3.html says more things
			           // understand mp3, but it's talking about audio files.
			           // https://stackoverflow.com/questions/9168954/should-i-use-the-mp3-or-aac-codec-for-a-mp4-file/25718378)
			           // has ambiguous answers. It would let us build a slightly smaller ffmpeg. It would tend to make
			           // slightly larger mp4s.
			           // Current thinking is that it's desirable if we're generating audio-only.
			           + (haveVideo ? "" : "-c:a libmp3lame ")
			           + "-map [out] " // send the output of the mix to the output
			           + finalOutputPath;
			Debug.WriteLine("args: " + args);
			_ffmpegProcess = new Process
			{
				StartInfo =
				{
					FileName = _ffmpegPath,
					Arguments = args,
					UseShellExecute = false, // enables CreateNoWindow
					CreateNoWindow = true, // don't need a DOS box
					RedirectStandardOutput = true,
					RedirectStandardError = true,
					RedirectStandardInput = true,
				}
			};
			_errorData.Clear();
			_ffmpegProcess.ErrorDataReceived += (o, receivedEventArgs) =>
			{
				_errorData.AppendLine(receivedEventArgs.Data);
			};
			_ffmpegProcess.Start();
			_ffmpegProcess.BeginOutputReadLine();
			_ffmpegProcess.BeginErrorReadLine();
			_ffmpegProcess.WaitForExit();
			Debug.WriteLine("merge errors:");
			Debug.WriteLine( _errorData.ToString());
			_recording = false;
			GotFullRecording = true;
			_webSocketServer.SendString("recordVideo","ready", "true");
			if (_saveReceived)
				SaveVideo(); // now we really can.
			Close();
		}
		public bool GotFullRecording { get; private set; }

		protected override void OnClosed(EventArgs e)
		{
			_saveReceived = false;
			base.OnClosed(e);
			if (_recording && _ffmpegProcess != null)
			{
				_ffmpegProcess.StandardInput.WriteLine("q"); // stop it asap
			}

			_initialVideo?.Dispose();
			_initialVideo = null;
		}

		// When the window is closed we will automatically be Disposed. But we might still be asked to
		// Save the final recording. So we can't get rid of that in Dispose. This will be called
		// when we're sure we need it no more.
		public void Cleanup()
		{
			_finalVideo?.Dispose();
			_finalVideo = null;
		}

		protected override void OnHandleCreated(EventArgs e)
		{
			base.OnHandleCreated(e);
			// BL-552, BL-779: a bug in Mono requires us to wait to set Icon until handle created.
			Icon = Properties.Resources.BloomIcon;
		}

		public void PlayVideo()
		{
			if (!GotFullRecording)
				return;
			Process.Start(_finalVideo.Path);
		}

		// Note: this method is very likely to be called after the window is closed and therefore disposed.
		public void SaveVideo()
		{
			_saveReceived = true;
			if (!GotFullRecording)
				return; // we'll be called again when done, unless the window was closed prematurely
			using (var dlg = new DialogAdapters.SaveFileDialogAdapter())
			{
				var extension = codec == "mp3" ? ".mp3" : ".mp4";
				string suggestedName = string.Format($"{Path.GetFileName(_pathToRealBook)}{extension}");
				dlg.FileName = suggestedName;
				var pdfFileLabel = L10NSharp.LocalizationManager.GetString(@"PublishTab.VideoFile",
					"Video File",
					@"displayed as file type for Save File dialog.");
				if (codec == "mp3")
				{
					pdfFileLabel = L10NSharp.LocalizationManager.GetString(@"PublishTab.AudioFile",
						"Audio File",
						@"displayed as file type for Save File dialog.");
				}

				pdfFileLabel = pdfFileLabel.Replace("|", "");
				dlg.Filter = String.Format("{0}|*{1}", pdfFileLabel, extension);
				dlg.OverwritePrompt = true;
				if (DialogResult.OK == dlg.ShowDialog())
				{
					RobustFile.Copy(_finalVideo.Path, dlg.FileName);
				}
			}
		}

		[DllImport("user32.dll", EntryPoint = "MoveWindow")]
		private static extern bool MoveWindow(IntPtr hWnd, int x, int y, int w, int h, bool repaint);

		protected override void SetBoundsCore(int x, int y, int width, int height, BoundsSpecified specified)
		{
			base.SetBoundsCore(x, y, width, height, specified);
			MoveWindow(Handle, x, y, width, height, true);
		}

		public static string GetDataForFormat(string format, bool landscape, 
			out int actualWidth, out int actualHeight, out string codec)
		{
			bool tooBigForScreen = false;
			int desiredWidth;
			int desiredHeight;
			switch (format)
			{
				default:
				case "facebook":
					desiredHeight = landscape ? 720 : 1280;
					desiredWidth = landscape ? 1280 : 720;
					codec = "h.264";
					break;
				case "feature":
					// review: are these right?
					desiredHeight = 320;
					desiredWidth = 240;
					codec = "h.263"; // todo: implement
					break;
				case "youtube":
					desiredHeight = landscape ? 1080 : 1920;
					desiredWidth = landscape ? 1920 : 1080;
					codec = "h.264";
					break;
				case "mp3":
					// review: what size video do we want to play?
					desiredHeight = landscape ? 720 : 1280;
					desiredWidth = landscape ? 1280 : 720;
					codec = "mp3"; // todo: implement
					break;
			}

			actualWidth = desiredWidth;
			actualHeight = desiredHeight;

			var mainWindow = Application.OpenForms.Cast<Form>().FirstOrDefault(f => f is Shell);
			if (mainWindow != null)
			{
				var bounds = Screen.FromControl(mainWindow).Bounds;
				var proto = new RecordVideoWindow(null);
				var deltaV = proto.Height - proto._content.Height;
				var deltaH = proto.Width - proto._content.Width;
				var maxHeight = bounds.Height - deltaV;
				var maxWidth = bounds.Width - deltaH;
				if (actualHeight > maxHeight)
				{
					tooBigForScreen = true;
					actualHeight = (maxHeight / 2) * 2; // round down to even, ffmpeg dies on odd sizes
					actualWidth = (actualHeight * desiredWidth / desiredHeight / 2) * 2;
				}

				if (actualWidth > maxWidth)
				{
					tooBigForScreen = true;
					actualWidth = (maxWidth / 2) * 2;
					actualHeight = (actualWidth * desiredHeight / desiredWidth / 2) * 2;
				}
			}

			if (tooBigForScreen)
			{
				var frame = LocalizationManager.GetString("Publish.RecordVideo.ScreenTooBig",
					"Ideally, this video target should be {0}. However that is larger than your screen, so Bloom will produce a video that is {1}.");
				return string.Format(frame, $"{desiredWidth} x {desiredHeight}", $"{actualWidth} x {actualHeight}");
			}

			return "";
		}

		public void SetFormat(string format, bool landscape)
		{
			GetDataForFormat(format, landscape, out _videoWidth, out _videoHeight, out codec);
		}

		public void SetPageReadTime(string pageReadTime)
		{
			_pageReadTime = pageReadTime;
		}

		public void SetVideoSettingsFromPreview(string videoSettings)
		{
			_videoSettingsFromPreview = videoSettings;
		}
	}

	class SoundLogItem
	{
		public string src;
		public double volume;
		public DateTime startTime;
		public TimeSpan startOffset;
		public DateTime endTime; // if not set, play the whole sound
	}
}
