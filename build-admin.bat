cd admin

npm run build

scp -i ~/.ssh/id_rsa_new_server -r build/* wubug:/var/www/xiaohongshu-web/admin/public/



pause