﻿using System;
using System.ComponentModel;
using System.ComponentModel.Design;
using System.Windows.Forms;
using Bloom.Properties;
using DesktopAnalytics;
using L10NSharp;

namespace Bloom.Registration
{
	public partial class RegistrationDialog : Form
	{
		private readonly bool _registrationIsOptional;
		private bool _hadEmailAlready;
		private static bool _haveRegisteredLaunch;

		public RegistrationDialog(bool registrationIsOptional)
		{
			InitializeComponent();

			if (ReallyDesignMode)
				return;

			_registrationIsOptional = registrationIsOptional;
			_hadEmailAlready = !string.IsNullOrWhiteSpace(SIL.Windows.Forms.Registration.Registration.Default.Email);

			_cancelButton.Visible = _registrationIsOptional;

			//Text = LocalizationManager.GetString("RegisterDialog.WindowTitle", "not used");
			Text = string.Format(Text, Application.ProductName);
			_headingLabel.Text = string.Format(_headingLabel.Text, Application.ProductName);
			_howUsingLabel.Text = string.Format(_howUsingLabel.Text, Application.ProductName);
		}

		protected bool ReallyDesignMode
		{
			get
			{
				return (base.DesignMode || GetService(typeof(IDesignerHost)) != null) ||
					(LicenseManager.UsageMode == LicenseUsageMode.Designtime);
			}
		}

		private void _userIsStuckDetector_Tick(object sender, EventArgs e)
		{
			_iAmStuckLabel.Visible = true;
		}

		private void OnIAmStuckLabel_LinkClicked(object sender, LinkLabelLinkClickedEventArgs e)
		{
			SaveAndSendIfPossible();//they might have filled some of it in
			Close();
		}

		private void OnTextChanged(object sender, EventArgs e)
		{
			UpdateDisplay();
		}

		private void UpdateDisplay()
		{
			_okButton.Enabled = !string.IsNullOrWhiteSpace(_firstName.Text) &&
								!string.IsNullOrWhiteSpace(_surname.Text) &&
								!string.IsNullOrWhiteSpace(_organization.Text) &&
								!string.IsNullOrWhiteSpace(_howAreYouUsing.Text);

			//reset the stuck detection timer
			_userIsStuckDetector.Stop();
			_userIsStuckDetector.Start();
		}

		private void _okButton_Click(object sender, EventArgs e)
		{
			SaveAndSendIfPossible();
			Close();
		}

		public static bool ShouldWeShowRegistrationDialog()
		{
			//there is no point registering if we are are developer/tester
			string feedbackSetting = System.Environment.GetEnvironmentVariable("FEEDBACK");
			if (!string.IsNullOrEmpty(feedbackSetting) && feedbackSetting.ToLowerInvariant() != "yes" &&
				feedbackSetting.ToLowerInvariant() != "true")
				return false;

			if (!_haveRegisteredLaunch)//in case the client app calls this more then once during a single run (like Bloom does when opening a different collection)
			{
				_haveRegisteredLaunch=true;

				if (SIL.Windows.Forms.Registration.Registration.Default.NeedUpgrade)
				{
					//see http://stackoverflow.com/questions/3498561/net-applicationsettingsbase-should-i-call-upgrade-every-time-i-load
					SIL.Windows.Forms.Registration.Registration.Default.Upgrade();
					SIL.Windows.Forms.Registration.Registration.Default.NeedUpgrade = false;
					SIL.Windows.Forms.Registration.Registration.Default.Save();
				}

				SIL.Windows.Forms.Registration.Registration.Default.LaunchCount++;
				SIL.Windows.Forms.Registration.Registration.Default.Save();
			}

			return SIL.Windows.Forms.Registration.Registration.Default.LaunchCount > 2 &&
				   (
					   string.IsNullOrWhiteSpace(SIL.Windows.Forms.Registration.Registration.Default.FirstName) ||
					   string.IsNullOrWhiteSpace(SIL.Windows.Forms.Registration.Registration.Default.Surname) ||
					   string.IsNullOrWhiteSpace(SIL.Windows.Forms.Registration.Registration.Default.Organization) ||
					   string.IsNullOrWhiteSpace(SIL.Windows.Forms.Registration.Registration.Default.Email)
				   );
		}

		private void SaveAndSendIfPossible()
		{
			SIL.Windows.Forms.Registration.Registration.Default.FirstName = _firstName.Text;
			SIL.Windows.Forms.Registration.Registration.Default.Surname = _surname.Text;
			SIL.Windows.Forms.Registration.Registration.Default.Organization = _organization.Text;
			SIL.Windows.Forms.Registration.Registration.Default.Email = _email.Text;
			SIL.Windows.Forms.Registration.Registration.Default.HowUsing = _howAreYouUsing.Text;
			SIL.Windows.Forms.Registration.Registration.Default.Save();
			try
			{
				DesktopAnalytics.Analytics.IdentifyUpdate(GetAnalyticsUserInfo());

				if (!_hadEmailAlready && !string.IsNullOrWhiteSpace(SIL.Windows.Forms.Registration.Registration.Default.Email))
				{
					DesktopAnalytics.Analytics.Track("Register");
				}

			}
			catch (Exception)
			{
				#if DEBUG	//else, it's not polite to complain
								throw;
				#endif
			}

		}

		public static UserInfo GetAnalyticsUserInfo()
		{
			UserInfo userInfo = new UserInfo()
				{
					FirstName = SIL.Windows.Forms.Registration.Registration.Default.FirstName,
					LastName = SIL.Windows.Forms.Registration.Registration.Default.Surname,
					Email = SIL.Windows.Forms.Registration.Registration.Default.Email,
					UILanguageCode = Settings.Default.UserInterfaceLanguage
				};
			userInfo.OtherProperties.Add("Organization", SIL.Windows.Forms.Registration.Registration.Default.Organization);
			userInfo.OtherProperties.Add("HowUsing", SIL.Windows.Forms.Registration.Registration.Default.HowUsing);
			return userInfo;
		}

		private void RegistrationDialog_Load(object sender, EventArgs e)
		{
			_firstName.Text = SIL.Windows.Forms.Registration.Registration.Default.FirstName;
			_surname.Text = SIL.Windows.Forms.Registration.Registration.Default.Surname;
			_organization.Text = SIL.Windows.Forms.Registration.Registration.Default.Organization;
			_email.Text = SIL.Windows.Forms.Registration.Registration.Default.Email;
			_howAreYouUsing.Text = SIL.Windows.Forms.Registration.Registration.Default.HowUsing;
			UpdateDisplay();
			//only need to do this now
			_email.TextChanged += new System.EventHandler(this.OnTextChanged);
		}

		private void _cancelButton_Click(object sender, EventArgs e)
		{
			Close();
		}

		protected override void OnHandleCreated(EventArgs e)
		{
			base.OnHandleCreated(e);

			// BL-832: a bug in Mono requires us to wait to set Icon until handle created.
			this.Icon = global::Bloom.Properties.Resources.BloomIcon;
		}
	}
}
