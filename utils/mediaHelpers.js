export const getMediaTypeName = (type) => {
  const map = {
    none: 'نصي',
    image: 'صورة',
    video: 'فيديو',
    both: 'صورة وفيديو',
  };
  return map[type] || 'نصي';
};

export const getMediaPreviewImage = (news) => {
  if (!news) return '';
  if (news.mediaType === 'both' && news.imageUrl) return news.imageUrl;
  if (news.mediaType === 'image' && news.imageUrl) return news.imageUrl;
  if (news.mediaType === 'video' && news.videoThumbnail) return news.videoThumbnail;
  if (news.imageUrl) return news.imageUrl;
  if (news.videoThumbnail) return news.videoThumbnail;
  return '';
};

export const formatDuration = (seconds) => {
  if (!seconds || seconds <= 0) return '';
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
};

export const isVideoNews = (news) => {
  if (!news) return false;
  return news.mediaType === 'video' || news.mediaType === 'both';
};