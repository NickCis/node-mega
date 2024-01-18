# Mega

Provide a direct linking api to a mega file.

After deployment the link should be: `https://<base>/<id>:<key>/...`.

The idea is to share a folder and be able to have a direct link to the files in that folder.

For example, if the share link is the following: `https://mega.nz/folder/XXXXX#YYYYYYYYYYY`, the link to access directly to a `test.pdf` file inside that folder will be the following: `https://<base>/XXXXX:YYYYYYYYYYY/test.pdf`

## TODO

- Use [sjcl](https://www.npmjs.com/package/sjcl) for edge functions crypto (CloudFlare doesn't implement the needed crypto api, Vercel uses the browsers implementation which doesn't implement `aes-128-cbc`). Megaupload website seems to use this library.
