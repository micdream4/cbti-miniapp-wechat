const templateLinks = require('../../config/template-links');

Page({
  data: {
    files: templateLinks
  },

  onCopyLink(e) {
    const { url, code } = e.currentTarget.dataset;
    if (!url) {
      wx.showToast({
        title: '请先配置下载链接',
        icon: 'none'
      });
      return;
    }

    const text = code ? `链接: ${url} 提取码: ${code}` : url;
    wx.setClipboardData({
      data: text,
      success: () => {
        wx.showToast({
          title: code ? '链接和提取码已复制' : '链接已复制',
          icon: 'success'
        });
      }
    });
  },

  onDownloadOpen(e) {
    const { url, code } = e.currentTarget.dataset;
    if (!url) {
      wx.showModal({
        title: '未配置链接',
        content: '请在 config/template-links.js 中填入可访问的 HTTPS 文件 URL。',
        showCancel: false
      });
      return;
    }

    if (url.includes('pan.baidu.com')) {
      const text = code ? `链接: ${url} 提取码: ${code}` : url;
      wx.setClipboardData({
        data: text,
        success: () => {
          wx.showModal({
            title: '网盘链接已复制',
            content: '请在手机浏览器或百度网盘 App 粘贴打开并下载。',
            showCancel: false
          });
        }
      });
      return;
    }

    wx.showLoading({ title: '正在打开...' });
    wx.downloadFile({
      url,
      success: (res) => {
        if (res.statusCode !== 200) {
          wx.showToast({ title: '下载失败', icon: 'none' });
          return;
        }
        wx.openDocument({
          filePath: res.tempFilePath,
          showMenu: true,
          fail: () => {
            wx.showModal({
              title: '打开失败',
              content: '请确认文件格式受支持，或改用复制链接在浏览器打开。',
              showCancel: false
            });
          }
        });
      },
      fail: () => {
        wx.showToast({ title: '下载失败', icon: 'none' });
      },
      complete: () => {
        wx.hideLoading();
      }
    });
  }
});
