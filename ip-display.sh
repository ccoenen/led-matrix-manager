# making sure this is always the current file, if any.
rm media/ip.png

# generating new file
/usr/bin/convert -size 192x32 -background black -fill darkgreen -font "DejaVu-Sans-Mono" -pointsize 10 label:"$(ip address show | grep -v "scope host" | awk '/inet6? / {split($2,var,"/*"); print var[1]}')" media/ip.png

# passing on th exit code, just in case.
exit $?
