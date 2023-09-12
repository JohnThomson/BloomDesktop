#!/bin/bash
# server=build.palaso.org
# project=Bloom
# build=Bloom-Default-Continuous
# root_dir=..
# Auto-generated by https://github.com/sillsdev/BuildUpdate.
# Do not edit this file by hand!

cd "$(dirname "$0")"

# *** Functions ***
force=0
clean=0

while getopts fc opt; do
case $opt in
f) force=1 ;;
c) clean=1 ;;
esac
done

shift $((OPTIND - 1))

copy_auto() {
if [ "$clean" == "1" ]
then
echo cleaning $2
rm -f ""$2""
else
where_curl=$(type -P curl)
where_wget=$(type -P wget)
if [ "$where_curl" != "" ]
then
copy_curl "$1" "$2"
elif [ "$where_wget" != "" ]
then
copy_wget "$1" "$2"
else
echo "Missing curl or wget"
exit 1
fi
fi
}

copy_curl() {
echo "curl: $2 <= $1"
if [ -e "$2" ] && [ "$force" != "1" ]
then
curl -# -L -z "$2" -o "$2" "$1"
else
curl -# -L -o "$2" "$1"
fi
}

copy_wget() {
echo "wget: $2 <= $1"
f1=$(basename $1)
f2=$(basename $2)
cd $(dirname $2)
wget -q -L -N "$1"
# wget has no true equivalent of curl's -o option.
# Different versions of wget handle (or not) % escaping differently.
# A URL query is the only reason why $f1 and $f2 should differ.
if [ "$f1" != "$f2" ]; then mv $f2\?* $f2; fi
cd -
}


# *** Results ***
# build: Bloom-Default-Continuous (bt222)
# project: Bloom
# URL: https://build.palaso.org/viewType.html?buildTypeId=bt222
# VCS: https://github.com/BloomBooks/BloomDesktop.git [refs/heads/master]
# dependencies:
# [0] build: bloom-win32-static-dependencies (bt396)
#     project: Bloom
#     URL: https://build.palaso.org/viewType.html?buildTypeId=bt396
#     clean: false
#     revision: latest.lastSuccessful
#     paths: {"ghostscript-win32.zip!**"=>"DistFiles/ghostscript", "connections.dll"=>"DistFiles", "MSBuild.Community.Tasks.dll"=>"build", "MSBuild.Community.Tasks.Targets"=>"build", "Lame.zip!**"=>"lib/lame", "gm.zip!**"=>"lib", "RedistributableDlls.zip!**"=>"lib/RedistributableDlls", "meddle.exe"=>"lib/dotnet"}
# [1] build: PortableDevices (from PodcastUtilities) (Bloom_PortableDevicesFromPodcastUtitlies)
#     project: Bloom
#     URL: https://build.palaso.org/viewType.html?buildTypeId=Bloom_PortableDevicesFromPodcastUtitlies
#     clean: false
#     revision: latest.lastSuccessful
#     paths: {"PodcastUtilities.PortableDevices.dll"=>"lib/dotnet", "PodcastUtilities.PortableDevices.pdb"=>"lib/dotnet", "Interop.PortableDeviceApiLib.dll"=>"lib/dotnet", "Interop.PortableDeviceTypesLib.dll"=>"lib/dotnet"}
#     VCS: https://github.com/BloomBooks/PodcastUtilities.git [refs/heads/master]
# [2] build: Squirrel (Bloom_Squirrel)
#     project: Bloom
#     URL: https://build.palaso.org/viewType.html?buildTypeId=Bloom_Squirrel
#     clean: false
#     revision: latest.lastSuccessful
#     paths: {"*.*"=>"lib/dotnet"}
#     VCS: https://github.com/BloomBooks/Squirrel.Windows.git [refs/heads/master]
# [3] build: Bloom Help 5.6 (Bloom_Help_BloomHelp56)
#     project: Help
#     URL: https://build.palaso.org/viewType.html?buildTypeId=Bloom_Help_BloomHelp56
#     clean: false
#     revision: latest.lastSuccessful
#     paths: {"*.chm"=>"DistFiles"}
# [4] build: PdfDroplet-Win-master-Continuous (bt54)
#     project: PdfDroplet
#     URL: https://build.palaso.org/viewType.html?buildTypeId=bt54
#     clean: false
#     revision: latest.lastSuccessful
#     paths: {"PdfDroplet.exe"=>"lib/dotnet", "PdfSharp.dll"=>"lib/dotnet"}
#     VCS: https://github.com/sillsdev/pdfDroplet [master]
# [5] build: TidyManaged-master-win32-continuous (bt349)
#     project: TidyManaged
#     URL: https://build.palaso.org/viewType.html?buildTypeId=bt349
#     clean: false
#     revision: latest.lastSuccessful
#     paths: {"*.*"=>"lib/dotnet"}
#     VCS: https://github.com/BloomBooks/TidyManaged.git [master]
# [6] build: Windows master continuous (XliffForHtml_WindowsMasterContinuous)
#     project: XliffForHtml
#     URL: https://build.palaso.org/viewType.html?buildTypeId=XliffForHtml_WindowsMasterContinuous
#     clean: false
#     revision: latest.lastSuccessful
#     paths: {"HtmlXliff.*"=>"lib/dotnet", "HtmlAgilityPack.*"=>"lib/dotnet"}
#     VCS: https://github.com/sillsdev/XliffForHtml [refs/heads/master]

# make sure output directories exist
mkdir -p ../DistFiles
mkdir -p ../DistFiles/ghostscript
mkdir -p ../Downloads
mkdir -p ../build
mkdir -p ../lib
mkdir -p ../lib/RedistributableDlls
mkdir -p ../lib/dotnet
mkdir -p ../lib/lame

# download artifact dependencies
copy_auto https://build.palaso.org/guestAuth/repository/download/bt396/latest.lastSuccessful/ghostscript-win32.zip ../Downloads/ghostscript-win32.zip
copy_auto https://build.palaso.org/guestAuth/repository/download/bt396/latest.lastSuccessful/connections.dll ../DistFiles/connections.dll
copy_auto https://build.palaso.org/guestAuth/repository/download/bt396/latest.lastSuccessful/MSBuild.Community.Tasks.dll ../build/MSBuild.Community.Tasks.dll
copy_auto https://build.palaso.org/guestAuth/repository/download/bt396/latest.lastSuccessful/MSBuild.Community.Tasks.Targets ../build/MSBuild.Community.Tasks.Targets
copy_auto https://build.palaso.org/guestAuth/repository/download/bt396/latest.lastSuccessful/Lame.zip ../Downloads/Lame.zip
copy_auto https://build.palaso.org/guestAuth/repository/download/bt396/latest.lastSuccessful/gm.zip ../Downloads/gm.zip
copy_auto https://build.palaso.org/guestAuth/repository/download/bt396/latest.lastSuccessful/RedistributableDlls.zip ../Downloads/RedistributableDlls.zip
copy_auto https://build.palaso.org/guestAuth/repository/download/bt396/latest.lastSuccessful/meddle.exe ../lib/dotnet/meddle.exe
copy_auto https://build.palaso.org/guestAuth/repository/download/Bloom_PortableDevicesFromPodcastUtitlies/latest.lastSuccessful/PodcastUtilities.PortableDevices.dll ../lib/dotnet/PodcastUtilities.PortableDevices.dll
copy_auto https://build.palaso.org/guestAuth/repository/download/Bloom_PortableDevicesFromPodcastUtitlies/latest.lastSuccessful/PodcastUtilities.PortableDevices.pdb ../lib/dotnet/PodcastUtilities.PortableDevices.pdb
copy_auto https://build.palaso.org/guestAuth/repository/download/Bloom_PortableDevicesFromPodcastUtitlies/latest.lastSuccessful/Interop.PortableDeviceApiLib.dll ../lib/dotnet/Interop.PortableDeviceApiLib.dll
copy_auto https://build.palaso.org/guestAuth/repository/download/Bloom_PortableDevicesFromPodcastUtitlies/latest.lastSuccessful/Interop.PortableDeviceTypesLib.dll ../lib/dotnet/Interop.PortableDeviceTypesLib.dll
copy_auto https://build.palaso.org/guestAuth/repository/download/Bloom_Squirrel/latest.lastSuccessful/7z.dll ../lib/dotnet/7z.dll
copy_auto https://build.palaso.org/guestAuth/repository/download/Bloom_Squirrel/latest.lastSuccessful/7z.exe ../lib/dotnet/7z.exe
copy_auto https://build.palaso.org/guestAuth/repository/download/Bloom_Squirrel/latest.lastSuccessful/DeltaCompressionDotNet.MsDelta.dll ../lib/dotnet/DeltaCompressionDotNet.MsDelta.dll
copy_auto https://build.palaso.org/guestAuth/repository/download/Bloom_Squirrel/latest.lastSuccessful/DeltaCompressionDotNet.PatchApi.dll ../lib/dotnet/DeltaCompressionDotNet.PatchApi.dll
copy_auto https://build.palaso.org/guestAuth/repository/download/Bloom_Squirrel/latest.lastSuccessful/DeltaCompressionDotNet.dll ../lib/dotnet/DeltaCompressionDotNet.dll
copy_auto https://build.palaso.org/guestAuth/repository/download/Bloom_Squirrel/latest.lastSuccessful/Microsoft.Data.Edm.dll ../lib/dotnet/Microsoft.Data.Edm.dll
copy_auto https://build.palaso.org/guestAuth/repository/download/Bloom_Squirrel/latest.lastSuccessful/Microsoft.Data.Edm.xml ../lib/dotnet/Microsoft.Data.Edm.xml
copy_auto https://build.palaso.org/guestAuth/repository/download/Bloom_Squirrel/latest.lastSuccessful/Microsoft.Data.OData.dll ../lib/dotnet/Microsoft.Data.OData.dll
copy_auto https://build.palaso.org/guestAuth/repository/download/Bloom_Squirrel/latest.lastSuccessful/Microsoft.Data.OData.xml ../lib/dotnet/Microsoft.Data.OData.xml
copy_auto https://build.palaso.org/guestAuth/repository/download/Bloom_Squirrel/latest.lastSuccessful/Microsoft.Data.Services.Client.dll ../lib/dotnet/Microsoft.Data.Services.Client.dll
copy_auto https://build.palaso.org/guestAuth/repository/download/Bloom_Squirrel/latest.lastSuccessful/Microsoft.Data.Services.Client.xml ../lib/dotnet/Microsoft.Data.Services.Client.xml
copy_auto https://build.palaso.org/guestAuth/repository/download/Bloom_Squirrel/latest.lastSuccessful/Microsoft.Web.XmlTransform.dll ../lib/dotnet/Microsoft.Web.XmlTransform.dll
copy_auto https://build.palaso.org/guestAuth/repository/download/Bloom_Squirrel/latest.lastSuccessful/Mono.Cecil.Mdb.dll ../lib/dotnet/Mono.Cecil.Mdb.dll
copy_auto https://build.palaso.org/guestAuth/repository/download/Bloom_Squirrel/latest.lastSuccessful/Mono.Cecil.Pdb.dll ../lib/dotnet/Mono.Cecil.Pdb.dll
copy_auto https://build.palaso.org/guestAuth/repository/download/Bloom_Squirrel/latest.lastSuccessful/Mono.Cecil.Rocks.dll ../lib/dotnet/Mono.Cecil.Rocks.dll
copy_auto https://build.palaso.org/guestAuth/repository/download/Bloom_Squirrel/latest.lastSuccessful/Mono.Cecil.dll ../lib/dotnet/Mono.Cecil.dll
copy_auto https://build.palaso.org/guestAuth/repository/download/Bloom_Squirrel/latest.lastSuccessful/NuGet.Squirrel.dll ../lib/dotnet/NuGet.Squirrel.dll
copy_auto https://build.palaso.org/guestAuth/repository/download/Bloom_Squirrel/latest.lastSuccessful/NuGet.Squirrel.pdb ../lib/dotnet/NuGet.Squirrel.pdb
copy_auto https://build.palaso.org/guestAuth/repository/download/Bloom_Squirrel/latest.lastSuccessful/Octokit.dll ../lib/dotnet/Octokit.dll
copy_auto https://build.palaso.org/guestAuth/repository/download/Bloom_Squirrel/latest.lastSuccessful/Setup.exe ../lib/dotnet/Setup.exe
copy_auto https://build.palaso.org/guestAuth/repository/download/Bloom_Squirrel/latest.lastSuccessful/SharpCompress.dll ../lib/dotnet/SharpCompress.dll
copy_auto https://build.palaso.org/guestAuth/repository/download/Bloom_Squirrel/latest.lastSuccessful/Squirrel.dll ../lib/dotnet/Squirrel.dll
copy_auto https://build.palaso.org/guestAuth/repository/download/Bloom_Squirrel/latest.lastSuccessful/Squirrel.pdb ../lib/dotnet/Squirrel.pdb
copy_auto https://build.palaso.org/guestAuth/repository/download/Bloom_Squirrel/latest.lastSuccessful/StubExecutable.exe ../lib/dotnet/StubExecutable.exe
copy_auto https://build.palaso.org/guestAuth/repository/download/Bloom_Squirrel/latest.lastSuccessful/SyncReleases.exe ../lib/dotnet/SyncReleases.exe
copy_auto https://build.palaso.org/guestAuth/repository/download/Bloom_Squirrel/latest.lastSuccessful/SyncReleases.pdb ../lib/dotnet/SyncReleases.pdb
copy_auto https://build.palaso.org/guestAuth/repository/download/Bloom_Squirrel/latest.lastSuccessful/System.Spatial.dll ../lib/dotnet/System.Spatial.dll
copy_auto https://build.palaso.org/guestAuth/repository/download/Bloom_Squirrel/latest.lastSuccessful/System.Spatial.xml ../lib/dotnet/System.Spatial.xml
copy_auto https://build.palaso.org/guestAuth/repository/download/Bloom_Squirrel/latest.lastSuccessful/Update-Mono.exe ../lib/dotnet/Update-Mono.exe
copy_auto https://build.palaso.org/guestAuth/repository/download/Bloom_Squirrel/latest.lastSuccessful/Update-Mono.pdb ../lib/dotnet/Update-Mono.pdb
copy_auto https://build.palaso.org/guestAuth/repository/download/Bloom_Squirrel/latest.lastSuccessful/Update.exe ../lib/dotnet/Update.exe
copy_auto https://build.palaso.org/guestAuth/repository/download/Bloom_Squirrel/latest.lastSuccessful/Update.pdb ../lib/dotnet/Update.pdb
copy_auto https://build.palaso.org/guestAuth/repository/download/Bloom_Squirrel/latest.lastSuccessful/WpfAnimatedGif.dll ../lib/dotnet/WpfAnimatedGif.dll
copy_auto https://build.palaso.org/guestAuth/repository/download/Bloom_Squirrel/latest.lastSuccessful/WriteZipToSetup.exe ../lib/dotnet/WriteZipToSetup.exe
copy_auto https://build.palaso.org/guestAuth/repository/download/Bloom_Squirrel/latest.lastSuccessful/rcedit.exe ../lib/dotnet/rcedit.exe
copy_auto https://build.palaso.org/guestAuth/repository/download/Bloom_Squirrel/latest.lastSuccessful/signtool.exe ../lib/dotnet/signtool.exe
copy_auto https://build.palaso.org/guestAuth/repository/download/Bloom_Squirrel/latest.lastSuccessful/squirrel.windows.props ../lib/dotnet/squirrel.windows.props
copy_auto https://build.palaso.org/guestAuth/repository/download/Bloom_Squirrel/latest.lastSuccessful/update.com ../lib/dotnet/update.com
copy_auto https://build.palaso.org/guestAuth/repository/download/Bloom_Help_BloomHelp56/latest.lastSuccessful/Bloom.chm ../DistFiles/Bloom.chm
copy_auto https://build.palaso.org/guestAuth/repository/download/bt54/latest.lastSuccessful/PdfDroplet.exe ../lib/dotnet/PdfDroplet.exe
copy_auto https://build.palaso.org/guestAuth/repository/download/bt54/latest.lastSuccessful/PdfSharp.dll ../lib/dotnet/PdfSharp.dll
copy_auto https://build.palaso.org/guestAuth/repository/download/bt349/latest.lastSuccessful/TidyManaged.dll ../lib/dotnet/TidyManaged.dll
copy_auto https://build.palaso.org/guestAuth/repository/download/bt349/latest.lastSuccessful/TidyManaged.dll.config ../lib/dotnet/TidyManaged.dll.config
copy_auto https://build.palaso.org/guestAuth/repository/download/bt349/latest.lastSuccessful/libtidy.dll ../lib/dotnet/libtidy.dll
copy_auto https://build.palaso.org/guestAuth/repository/download/XliffForHtml_WindowsMasterContinuous/latest.lastSuccessful/HtmlXliff.exe ../lib/dotnet/HtmlXliff.exe
copy_auto https://build.palaso.org/guestAuth/repository/download/XliffForHtml_WindowsMasterContinuous/latest.lastSuccessful/HtmlXliff.pdb ../lib/dotnet/HtmlXliff.pdb
copy_auto https://build.palaso.org/guestAuth/repository/download/XliffForHtml_WindowsMasterContinuous/latest.lastSuccessful/HtmlAgilityPack.dll ../lib/dotnet/HtmlAgilityPack.dll
# extract downloaded zip files
unzip -uqo ../Downloads/ghostscript-win32.zip -d "../DistFiles/ghostscript"
unzip -uqo ../Downloads/Lame.zip -d "../lib/lame"
unzip -uqo ../Downloads/gm.zip -d "../lib"
unzip -uqo ../Downloads/RedistributableDlls.zip -d "../lib/RedistributableDlls"
# End of script
