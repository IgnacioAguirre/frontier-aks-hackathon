#!/usr/bin/env bash
set -euo pipefail

KUBELOGIN_VERSION=$(curl -s https://api.github.com/repos/Azure/kubelogin/releases/latest \
    | grep '"tag_name"' | cut -d'"' -f4)
curl -sL "https://github.com/Azure/kubelogin/releases/download/${KUBELOGIN_VERSION}/kubelogin-linux-amd64.zip" \
    -o /tmp/kubelogin.zip
unzip -q /tmp/kubelogin.zip -d /tmp/kubelogin
sudo mv /tmp/kubelogin/bin/linux_amd64/kubelogin /usr/local/bin/kubelogin
sudo chmod +x /usr/local/bin/kubelogin
rm -rf /tmp/kubelogin*
