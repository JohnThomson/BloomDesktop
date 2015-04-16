using System;
using System.Collections.Generic;
using System.Diagnostics;
using System.Linq;
using System.Text;
using System.Threading.Tasks;
using Bloom.WebLibraryIntegration;
using RestSharp;

namespace FixTemplateStatus
{
	/// <summary>
	/// This simple program lives in a stash on my bloom system called FixTemplateStatus.
	/// If you find it as a backup elsewhere and can't restore that stash,
	/// - it needs to be added as a project to the Bloom solution
	/// - it needs a valid reference to Bloom.exe
	/// - it needs a couple of methods in BloomParseClient made public, and a new one
	///         public dynamic PerformRequest(RestRequest request)
    ///    {
    ///        var response = _client.Execute(request);
    ///        return JsonConvert.DeserializeObject<dynamic>(response.Content);
    ///    }
    /// - it needs a new method in S3Client:
    ///         public void UploadFile(string content, string key)
		///{
		///	var request = new TransferUtilityUploadRequest()
		///	{
		///		BucketName = _bucketName,
		///		InputStream = new MemoryStream(Encoding.UTF8.GetBytes(content)),
		///		Key = key
		///	};
		///	_transferUtility.Upload(request);
		///}
	/// - to make it work on the live web site change a line in BookTransfer.cs so that UseSandbox returns false
	/// - to allow it to update parse.com, the login information needs to specify a user who is in the admin group.
	///		You will need to supply the password, I'm not checking it in, even to a local stash, with that in place.
	/// - consider running once first with the foreach replaced with the commented line above, to test on just one book.
	/// </summary>
	static class Program
	{
		private static BloomS3Client s3Client;
		private static string bucketName;
		static private BloomParseClient parseClient;
		static void Main(string[] args)
		{
			parseClient = new BloomParseClient();
			parseClient.LogIn("librarian@bloomlibrary.org", "");
			//parseClient.LogIn("ken@example.com", "KenZ");

			bucketName = BookTransfer.UseSandbox ? BloomS3Client.SandboxBucketName : BloomS3Client.ProductionBucketName;
			s3Client = new BloomS3Client(bucketName);
			var request = parseClient.MakeGetRequest("classes/books");
			request.AddParameter("count", "1");
			//request.AddParameter("limit", "0");
			request.AddParameter("where", "{\"suitableForMakingShells\":true}");
			var response = parseClient.PerformRequest(request);
			//var item = response.results[0];
			foreach (var item in response.results)
				FixBook(item);
		}

		static void FixBook(dynamic bookData)
		{
			string rawUrl = bookData.baseUrl;
			string url = System.Web.HttpUtility.UrlDecode(rawUrl);
			string title = bookData.title;
			if (title == "Story Primer")
				return; // The one known book that IS a template
			string id = bookData.objectId;
			Debug.WriteLine(title);

			var request = parseClient.MakePutRequest("classes/books/" + id);
			request.AddParameter("application/json", "{\"suitableForMakingShells\":false}", ParameterType.RequestBody);
			var response = parseClient.PerformRequest(request);

			var storageKeyOfFile = url.Replace("%2f", "/").Substring("https://s3.amazonaws.com/".Length + bucketName.Length + 1) + "meta.json";
			string meta = s3Client.DownloadFile(storageKeyOfFile);
			string fixedMeta = meta.Replace("\"suitableForMakingShells\":true", "\"suitableForMakingShells\":false");
			s3Client.UploadFile(fixedMeta, storageKeyOfFile);
		}
	}
}
