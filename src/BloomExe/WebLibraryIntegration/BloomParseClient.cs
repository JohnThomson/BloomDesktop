﻿using System;
using System.Collections.Generic;
using System.Net;
using System.Text;
using System.Windows.Forms;
using Bloom.Book;
using Bloom.Properties;
using Bloom.web;
using Newtonsoft.Json;
using Newtonsoft.Json.Linq;
using RestSharp;
using SIL.Progress;

namespace Bloom.WebLibraryIntegration
{
	public class BloomParseClient
	{
		protected RestClient _client;
		protected string _sessionToken = String.Empty;
		protected string _userId;

		public BloomParseClient()
		{
			var keys = AccessKeys.GetAccessKeys(BookUpload.UploadBucketNameForCurrentEnvironment);

			RestApiKey = keys.ParseApiKey;
			ApplicationId = keys.ParseApplicationKey;
		}

		public void SetLoginData(string account, string parseUserObjectId, string sessionToken, string destination)
		{
			Account = account;
			Settings.Default.WebUserId = account;
			Settings.Default.LastLoginSessionToken = sessionToken;
			Settings.Default.LastLoginDest = destination;
			Settings.Default.LastLoginParseObjectId = parseUserObjectId;
			Settings.Default.Save();
			_userId = parseUserObjectId;
			_sessionToken = sessionToken;
		}

		public bool AttemptSignInAgainForCommandLine(string userEmail, string destination, IProgress progress)
		{
			if (string.IsNullOrEmpty(Settings.Default.LastLoginSessionToken)){
				progress.WriteError("Please first log in from Bloom:Publish:Web, then quit and try again. (LastLoginSessionToken)");
				return false;
			}
			if (string.IsNullOrEmpty(Settings.Default.LastLoginParseObjectId))
			{
				progress.WriteError("Please first log in from Bloom:Publish:Web, then quit and try again. (LastLoginParseObjectId)");
				return false;
			}
			if (Settings.Default.WebUserId != userEmail)
			{
				progress.WriteError("The email from the last login from the Bloom UI does not match the -u argument.");
				return false;
			}
			if (Settings.Default.LastLoginDest != destination)
			{
				// this is important because the user settings we're going to read are from the version of Bloom, and so the
				// token will be whatever we logged into last here, and it won't work if it is from one Parse server and
				// we're using the other.
				progress.WriteError($"The destination of the last login from Bloom {ApplicationUpdateSupport.ChannelName} was '{Settings.Default.LastLoginDest}' which does not match the -d argument, '{destination}'");
				return false;
			}

			SetLoginData(Settings.Default.WebUserId, Settings.Default.LastLoginParseObjectId,
				Settings.Default.LastLoginSessionToken, destination);

			return true;
		}

		protected RestClient Client
		{
			get
			{
				if (_client == null)
				{
					_client = new RestClient(GetRealUrl());
				}
				return _client;
			}
		}

		// REST key. Unit tests update these.
		public string RestApiKey { get; private set; }
		public string ApplicationId { get; protected set; }

		// Don't even THINK of making this mutable so each unit test uses a different class.
		// Those classes hang around, can only be deleted manually, and eventually use up a fixed quota of classes.
		protected const string ClassesLanguagePath = "classes/language";

		public string UserId {get { return _userId; }}

		public string Account { get; protected set; }

		public bool LoggedIn
		{
			get
			{
				return !string.IsNullOrEmpty(_sessionToken);
			}
		}

		public string GetRealUrl()
		{
			return UrlLookup.LookupUrl(UrlType.Parse, null, BookUpload.UseSandbox);
		}

		private RestRequest MakeRequest(string path, Method requestType)
		{
			// client.Authenticator = new HttpBasicAuthenticator(username, password);
			var request = new RestRequest(path, requestType);
			SetCommonHeaders(request);
			if (!string.IsNullOrEmpty(_sessionToken))
				request.AddHeader("X-Parse-Session-Token", _sessionToken);
			return request;
		}

		protected RestRequest MakeGetRequest(string path)
		{
			return MakeRequest(path, Method.GET);
		}

		private void SetCommonHeaders(RestRequest request)
		{
			request.AddHeader("X-Parse-Application-Id", ApplicationId);
			request.AddHeader("X-Parse-REST-API-Key", RestApiKey); // REVIEW: Is this actually needed/used by our own parse-server? parse-server index.js suggests it is optional.
		}

		private RestRequest MakePostRequest(string path)
		{
			return MakeRequest(path, Method.POST);
		}

		private RestRequest MakePutRequest(string path)
		{
			return MakeRequest(path, Method.PUT);
		}
		private RestRequest MakeDeleteRequest(string path)
		{
			return MakeRequest(path, Method.DELETE);
		}

		public int GetBookCount(string query = null)
		{
			if (!UrlLookup.CheckGeneralInternetAvailability(false))
				return -1;
			var request = MakeGetRequest("classes/books");
			request.AddParameter("count", "1");
			request.AddParameter("limit", "0");
			if (!string.IsNullOrEmpty(query))
				request.AddParameter("where", query, ParameterType.QueryString);
			var response = Client.Execute(request);
			// If not successful return -1; this can happen if we aren't online.
			if (!response.IsSuccessful)
				return -1;
			var dy = JsonConvert.DeserializeObject<dynamic>(response.Content);
			return dy.count;
		}

		/// <summary>
		/// Get the number of books on bloomlibrary.org that are in the given language.
		/// </summary>
		/// <remarks>Query should get all books where the isoCode matches the given languageCode
		/// and 'rebrand' is not true and 'inCirculation' is not false and 'draft' is not true.</remarks>
		public int GetBookCountByLanguage(string languageCode)
		{
			string query = @"{
				""langPointers"":{""$inQuery"":{""where"":{""isoCode"":""" + languageCode + @"""},""className"":""language""}},
				""rebrand"":{""$ne"":true},""inCirculation"":{""$ne"":false},""draft"":{""$ne"":true}
			}";
			return GetBookCount(query);
		}

		// Setting param 'includeLanguageInfo' to true adds a param to the query that causes it to fold in
		// useful language information instead of only having the arcane langPointers object.
		private IRestResponse GetBookRecordsByQuery(string query, bool includeLanguageInfo)
		{
			var request = MakeGetRequest("classes/books");
			request.AddParameter("where", query, ParameterType.QueryString);
			if (includeLanguageInfo)
			{
				request.AddParameter("include", "langPointers", ParameterType.QueryString);
			}
			return Client.Execute(request);
		}

		// Will throw an exception if there is any reason we can't make a successful query, including if there is no internet.
		public dynamic GetSingleBookRecord(string id, bool includeLanguageInfo = false)
		{
			var json = GetBookRecords(id, includeLanguageInfo);
			if (json == null || json.Count < 1)
				return null;

			return json[0];
		}

		/// <summary>
		/// The string that needs to be embedded in json, either to query for books uploaded by this user,
		/// or to specify that a book is. (But see the code in BookMetaData which is also involved in upload.)
		/// </summary>
		public string UploaderJsonString
		{
			get
			{
				return "\"uploader\":{\"__type\":\"Pointer\",\"className\":\"_User\",\"objectId\":\"" + UserId + "\"}";
			}
		}

		// Query parse for books.
		// Will throw an exception if there is any reason we can't make a successful query, including if there is no internet.
		public dynamic GetBookRecords(string id, bool includeLanguageInfo, bool includeBooksFromOtherUploaders = false)
		{
			// For current usage of this method, we really need to know the difference between "no books found" and "we couldn't check".
			// So all paths which don't allow us to check need to throw.
			// Note that all this gets completely reworked in 5.7, so we don't have to live with this very long.

			if (!UrlLookup.CheckGeneralInternetAvailability(false)) {
				SIL.Reporting.Logger.WriteEvent("Internet was unavailable when trying to get book records.");
				throw new ApplicationException("Unable to look up book records because there is no internet connection.");
			}
			var query = "{\"bookInstanceId\":\"" + id + "\"";
			if (!includeBooksFromOtherUploaders)
			{
				query += "," + UploaderJsonString;
			}
			query += "}";
			var response = GetBookRecordsByQuery(query, includeLanguageInfo);
			if (response.StatusCode != HttpStatusCode.OK)
			{
				SIL.Reporting.Logger.WriteEvent($"Unable to query book records on parse.\n" +
					$"query = {query}\n" +
					$"response.StatusCode = {response.StatusCode}\n" +
					$"response.Content = {response.Content}"
					);
				throw new ApplicationException("Unable to look up book records.");
			}
			dynamic json = JObject.Parse(response.Content);
			if (json == null)
			{
				SIL.Reporting.Logger.WriteEvent($"Unable to parse book records query result.\n" +
					$"response.Content = {response.Content}");
				throw new ApplicationException("Unable to look up book records.");
			}
			return json.results;
		}

		public void Logout(bool includeFirebaseLogout = true)
		{
			Settings.Default.WebUserId = ""; // Should not be able to log in again just by restarting
			_sessionToken = null;
			Account = "";
			_userId = "";
			if (includeFirebaseLogout)
				BloomLibraryAuthentication.Logout();
		}

		public IRestResponse CreateBookRecord(string metadataJson)
		{
			if (!LoggedIn)
				throw new ApplicationException();
			if (BookUpload.IsDryRun)
				throw new ApplicationException("Should not call CreateBookRecord during dry run!");
			var request = MakePostRequest("classes/books");
			request.AddParameter("application/json", metadataJson, ParameterType.RequestBody);
			var response = Client.Execute(request);
			if (response.StatusCode != HttpStatusCode.Created)
			{
				var message = new StringBuilder();

				message.AppendLine("Request.Json: " + metadataJson);
				message.AppendLine("Response.Code: " + response.StatusCode);
				message.AppendLine("Response.Uri: " + response.ResponseUri);
				message.AppendLine("Response.Description: " + response.StatusDescription);
				message.AppendLine("Response.Content: " + response.Content);
				throw new ApplicationException(message.ToString());
			}
			return response;
		}

		public IRestResponse SetBookRecord(string metadataJson)
		{
			if (!LoggedIn)
				throw new ApplicationException("BloomParseClient got SetBookRecord, but the user is not logged in.");
			if (BookUpload.IsDryRun)
				throw new ApplicationException("Should not call SetBookRecord during dry run!");
			var metadata = BookMetaData.FromString(metadataJson);
			var book = GetSingleBookRecord(metadata.Id);
			metadataJson = ChangeJsonBeforeCreatingOrModifyingBook(metadataJson);
			if (book == null)
				return CreateBookRecord(metadataJson);

			var request = MakePutRequest("classes/books/" + book.objectId);
			request.AddParameter("application/json", metadataJson, ParameterType.RequestBody);
			var response = Client.Execute(request);
			if (response.StatusCode != HttpStatusCode.OK)
				throw new ApplicationException("BloomParseClient.SetBookRecord: "+response.StatusDescription + " " + response.Content);
			return response;
		}

		// Currently (April 2020), this is only used by unit tests
		public virtual string ChangeJsonBeforeCreatingOrModifyingBook(string json)
		{
			// No-op for base class
			return json;
		}

		/// <summary>
		/// Delete a book record in the parse server database
		/// Currently (April 2020), this is only used by unit tests
		/// </summary>
		public void DeleteBookRecord(string bookObjectId)
		{
			if (!LoggedIn)
				throw new ApplicationException("Must be logged in to delete book");
			if (BookUpload.IsDryRun)
				throw new ApplicationException("Should not call DeleteBookRecord during dry run!");
			var request = MakeDeleteRequest("classes/books/" + bookObjectId);
			var response = Client.Execute(request);
			if (response.StatusCode != HttpStatusCode.OK)
				throw new ApplicationException(response.StatusDescription + " " + response.Content);
		}

		public void DeleteLanguages()
		{
			if (!LoggedIn)
				throw new ApplicationException();
			if (BookUpload.IsDryRun)
				throw new ApplicationException("Should not call DeleteLanguages during dry run!");
			var getLangs = MakeGetRequest(ClassesLanguagePath);
			var response1 = Client.Execute(getLangs);
			dynamic json = JObject.Parse(response1.Content);
			if (json == null || response1.StatusCode != HttpStatusCode.OK)
				return;
			foreach (var obj in json.results)
			{
				var request = MakeDeleteRequest(ClassesLanguagePath + "/" + obj.objectId);
				var response = Client.Execute(request);
				if (response.StatusCode != HttpStatusCode.OK)
					throw new ApplicationException(response.StatusDescription + " " + response.Content);
			}
		}

		public dynamic CreateLanguage(LanguageDescriptor lang)
		{
			if (!LoggedIn)
				throw new ApplicationException();
			if (BookUpload.IsDryRun)
			{
				Console.WriteLine("Simulating CreateLanguage during dry run for {0} ({1})", lang.Name, lang.EthnologueCode);
				return JObject.Parse($"{{\"objectId\":\"xyzzy{lang.EthnologueCode}\"}}");
			}
			var request = MakePostRequest(ClassesLanguagePath);
			var langjson = lang.Json;
			request.AddParameter("application/json", langjson, ParameterType.RequestBody);
			var response = Client.Execute(request);
			if (response.StatusCode != HttpStatusCode.Created)
			{
				var message = new StringBuilder();

				message.AppendLine("Request.Json: " + langjson);
				message.AppendLine("Response.Code: " + response.StatusCode);
				message.AppendLine("Response.Uri: " + response.ResponseUri);
				message.AppendLine("Response.Description: " + response.StatusDescription);
				message.AppendLine("Response.Content: " + response.Content);
				throw new ApplicationException(message.ToString());
			}
			return JObject.Parse(response.Content);
		}

		public bool LanguageExists(LanguageDescriptor lang)
		{
			return LanguageCount(lang) > 0;
		}

		internal int LanguageCount(LanguageDescriptor lang)
		{
			var getLang = MakeGetRequest(ClassesLanguagePath);
			getLang.AddParameter("where", lang.Json, ParameterType.QueryString);
			var response = Client.Execute(getLang);
			if (response.StatusCode != HttpStatusCode.OK)
				return 0;
			dynamic json = JObject.Parse(response.Content);
			if (json == null)
				return 0;
			var results = json.results;
			return results.Count;
		}

		internal string LanguageId(LanguageDescriptor lang)
		{
			var getLang = MakeGetRequest(ClassesLanguagePath);
			getLang.AddParameter("where", lang.Json, ParameterType.QueryString);
			var response = Client.Execute(getLang);
			if (response.StatusCode != HttpStatusCode.OK)
				return null;
			dynamic json = JObject.Parse(response.Content);
			if (json == null || json.results.Count < 1)
				return null;
			return json.results[0].objectId;
		}

		internal dynamic GetLanguage(string objectId)
		{
			var getLang = MakeGetRequest(ClassesLanguagePath + "/" + objectId);
			var response = Client.Execute(getLang);
			if (response.StatusCode != HttpStatusCode.OK)
				return null;
			return JObject.Parse(response.Content);
		}

		internal void SendResetPassword(string account)
		{
			if (BookUpload.IsDryRun)
				throw new ApplicationException("Should not call SendResetPassword during dry run!");
			var request = MakePostRequest("requestPasswordReset");
			request.AddParameter("application/json; charset=utf-8", "{\"email\":\""+account+ "\"}", ParameterType.RequestBody);
			request.RequestFormat = DataFormat.Json;
			Client.Execute(request);
		}

		internal bool UserExists(string account)
		{
			var request = MakeGetRequest("users");
			request.AddParameter("where", "{\"username\":\"" + account.ToLowerInvariant() + "\"}");
			var response = Client.Execute(request);
			var dy = JsonConvert.DeserializeObject<dynamic>(response.Content);
			// Todo
			return dy.results.Count > 0;
		}

		internal bool IsThisVersionAllowedToUpload()
		{
			var request = MakeGetRequest("classes/version");
			var response = Client.Execute(request);
			var dy = JsonConvert.DeserializeObject<dynamic>(response.Content);
			var row = dy.results[0];
			string versionString = row.minDesktopVersion;
			var parts = versionString.Split('.');
			var requiredMajorVersion = int.Parse(parts[0]);
			var requiredMinorVersion = int.Parse(parts[1]);
			parts = Application.ProductVersion.Split('.');
			var ourMajorVersion = int.Parse(parts[0]);
			var ourMinorVersion = int.Parse(parts[1]);
			if (ourMajorVersion == requiredMajorVersion)
				return ourMinorVersion >= requiredMinorVersion;
			return ourMajorVersion >= requiredMajorVersion;
		}

		/// <summary>
		/// Get the language pointers we need to refer to a sequence of languages.
		/// If matching languages don't exist they will be created (requires user to be logged in)
		/// </summary>
		/// <param name="languages"></param>
		/// <returns></returns>
		internal ParseServerObjectPointer[] GetLanguagePointers(LanguageDescriptor[] languages)
		{
			var result = new ParseServerObjectPointer[languages.Length];
			for (int i = 0; i < languages.Length; i++)
			{
				var lang = languages[i];
				var id = LanguageId(lang);
				if (id == null)
				{
					var language = CreateLanguage(lang);
					id = language["objectId"].Value;
				}
				result[i] = new ParseServerObjectPointer() {ClassName = "language", ObjectId = id};
			}
			return result;
		}

		/// <summary>
		/// Query the parse server for the status of the given books.  The returned dictionary will have
		/// an entry for each book that has been uploaded to the parse server.  The keys are the book ids
		/// from the BookInfo objects.
		/// Books with no entry in the dictionary have not been uploaded to Bloom Library.  Books that have
		/// multiple uploads with the same bookInstanceId are flagged as having a problem by having an empty
		/// string for the BloomLibraryStatus.BloomLibraryBookUrl field.  (The other fields are meaningless
		/// in that case.)
		/// </summary>
		/// <remarks>
		/// We want to minimize the number of queries we make to the parse server, so we batch up the book
		/// ids as much as possible.
		/// </remarks>
		public Dictionary<string, BloomLibraryStatus> GetLibraryStatusForBooks(List<BookInfo> bookInfos)
		{
			System.Diagnostics.Debug.WriteLine($"DEBUG BloomParseClient.GetLibraryStatusForBooks(): {bookInfos.Count} books");
			var bloomLibraryStatusesById = new Dictionary<string, BloomLibraryStatus>();
			if (!UrlLookup.CheckGeneralInternetAvailability(false))
				return bloomLibraryStatusesById;
			var queryBldr = new StringBuilder();
			queryBldr.Append("{\"bookInstanceId\":{\"$in\":[\"");
			var bookIds = new List<string>();
			for (int i = 0; i < bookInfos.Count; ++i)
			{
				// More than 21 bookIds in a query causes a 400 error.
				// Just to be safe, we'll limit it to 20.
				bookIds.Add(bookInfos[i].Id);
				if (bookIds.Count % 20 == 0 || i == bookInfos.Count - 1)
				{
					queryBldr.Append(string.Join("\",\"", bookIds.ToArray()));
					queryBldr.Append("\"]}}");
					var response = GetBookRecordsByQuery(queryBldr.ToString(), false);
					if (response.StatusCode != HttpStatusCode.OK)
						continue;
					dynamic json = JObject.Parse(response.Content);
					if (json == null)
						continue;
					// store data from the dynamic json object into BloomLibraryStatus objects
					var bookStates = JArray.FromObject(json.results);
					for (int j = 0; j < bookStates.Count; ++j)
					{
						var id = bookStates[j].bookInstanceId.ToString();
						if (bloomLibraryStatusesById.ContainsKey(id))
						{
							bloomLibraryStatusesById[id] = new BloomLibraryStatus(false, false, HarvesterState.Multiple,
								BloomLibraryUrls.BloomLibraryBooksWithMatchingIdListingUrl(id));
						}
						else
						{
							bloomLibraryStatusesById[id] = BloomLibraryStatus.FromDynamicJson(bookStates[j]);
						}
					}
					queryBldr.Clear();
					queryBldr.Append("{\"bookInstanceId\":{\"$in\":[\"");
					bookIds.Clear();
				}
			}
			return bloomLibraryStatusesById;
		}
	}
}
