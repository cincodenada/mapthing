if [[ -z ${1} ]]
then
    echo "No name specified, exiting!"
    exit 1
elif [[ -e "$1.ab" || -e "${1}.db" ]]
then
    echo "Files exist, exiting!"
    exit 2
fi

adb backup -f ${1}.ab -noapk nl.sogeti.android.gpstracker
dd if=${1}.ab bs=1 skip=24 | python -c "import zlib,sys;sys.stdout.write(zlib.decompress(sys.stdin.read()))" | tar -xvf -
mv apps/nl.sogeti.android.gpstracker/db/*.db ${1}.db
rm -r apps
