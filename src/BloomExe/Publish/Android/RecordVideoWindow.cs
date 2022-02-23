using System;
using System.Collections.Generic;
using System.ComponentModel;
using System.Data;
using System.Diagnostics;
using System.Drawing;
using System.IO;
using System.Linq;
using System.Text;
using System.Threading.Tasks;
using System.Windows.Forms;
using Bloom.Api;
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

		public RecordVideoWindow()
		{
			InitializeComponent();
			_content = new Browser();
			_content.Dock = DockStyle.Fill;
			Controls.Add(_content);
		}

		public void Show(string bookUrl)
		{
			_bookFolder = Path.GetDirectoryName(bookUrl.FromLocalhost());
			var url = BloomServer.ServerUrlWithBloomPrefixEndingInSlash
			+ "bloom-player/dist/bloomplayer.htm?centerVertically=true&reportSoundLog=true&initiallyShowAppBar=false&forceAutoPlay=true&hideNavButtons=true&url=" + bookUrl
				+ "&independent=false&host=bloomdesktop";
			_content.Navigate(url, false);
			// want this size
			var videoHeight = 720;
			var videoWidth = 1280;
			var deltaV = this.Height - _content.Height;
			var deltaH = this.Width - _content.Width;
			Height = videoHeight + deltaV;
			Width = videoWidth + deltaH;
			Show();
		}

		protected override void OnLoad(EventArgs e)
		{
			base.OnLoad(e);
			var timer = new Timer();
			_videoOnlyPath = @"d:\temp\output.mp4"; // Todo
			RobustFile.Delete(_videoOnlyPath);
			//return;
			timer.Tick += (sender, eventArgs) =>
			{
				timer.Stop();
				_ffmpegPath = @"d:\ffmpeg\bin\ffmpeg.exe";

				var args =
							//"-t 10 " // duration limit"
							"-f gdigrab " // basic command for using a windows window as a video input stream
						   + "-framerate 30 " // frames per second to capture (30fps is standard for SD video)
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
				_errorData = new StringBuilder();
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
			};
			timer.Interval = 1000;
			timer.Start();
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
			Debug.WriteLine("Telling ffmpeg to quit");
			_ffmpegProcess.StandardInput.WriteLine("q");
			_ffmpegProcess.WaitForExit();
			Debug.WriteLine("full error log: " + _errorData.ToString());
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

			var finalOutputPath = @"d:\temp\output2.mp4"; // todo
			RobustFile.Delete(finalOutputPath);
			if (soundLog.Length == 0)
			{
				RobustFile.Copy(_videoOnlyPath, finalOutputPath);
				return;
			}

			var inputs = string.Join(" ", soundLog.Select(item => $"-i \"{item.src}\" "));

			var mixArgs = string.Join(" ", soundLog.Select((item, index) =>
			{
				var result = $"[{index + 1}:a]";
				if (item.endTime != default(DateTime))
				{
					var duration = (item.endTime - item.startTime);


					result += $"atrim=end={duration.TotalSeconds},";
				}

				var delay = item.startTime - _startTime;
				// all=1: in case the input is stereo, all channels of it will be delayed.
				result += $"adelay={delay.TotalMilliseconds}:all=1";

				if (item.volume != 1.0)
				{
					result += $",volume={item.volume}";
				}

				result += $"[a{index + 1}]; ";
				return result;
			}));

			var mixInputs = string.Join("", soundLog.Select((item, index) => $"[a{index + 1}]"));

			var args = ""
					   + $"-i \"{_videoOnlyPath}\" " // first input 0 is the original video
					   + inputs // the audio files are inputs, which may be referred to as [1:a], [2:a], etc.
					   + "-filter_complex \"" // the next bit specifies a filter with multiple inputs
					   + mixArgs // specifies the inputs to the mixer
					   // mix those inputs to a single stream called out
					   + mixInputs + $"amix=inputs={soundLog.Length}:normalize=0[out]\" "
					   + "-map 0:v -c:v copy " // copy the video channel (of input 0) unchanged
					   + "-map [out] " // send the output of the mix to the output
			           + finalOutputPath;
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
