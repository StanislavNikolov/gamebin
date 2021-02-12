cd pishtov


echo "BEGIN;"

find . -not -path './.git*' -type f -printf '%P\n' | \
while read file; do
	if [[ "$file" != "game.js" ]]; then
		path="$PWD/$file"
		echo "INSERT INTO files (content) VALUES (pg_read_binary_file('$path'));"
		echo "INSERT INTO framework_files (framework_name, file_contents_hash, filename) VALUES ('v1', MD5(pg_read_binary_file('$path')), '$file');"
	fi
done

echo "COMMIT"
