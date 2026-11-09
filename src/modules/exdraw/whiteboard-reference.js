// Only a real whiteboard node authorizes an embedded scene. Text, links and
// client-supplied node descriptions are never used as reference evidence.
export const hasWhiteboardReference = (elements, fileUuid, serviceUrl) => {
  if (!Array.isArray(elements)) return false;
  const service = new URL(serviceUrl);
  const prefix = `${service.pathname.replace(/\/$/, '')}/smart-link/`;
  const pending = [...elements];
  while (pending.length) {
    const node = pending.pop();
    if (!node || typeof node !== 'object' || node.isDeleted) continue;
    if (node.type === 'whiteboard' && typeof node.link === 'string') {
      try {
        const link = new URL(node.link);
        if (link.origin === service.origin && !link.username && !link.password &&
            link.pathname.startsWith(prefix)) {
          const match = link.pathname.slice(prefix.length).match(/^([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})\/$/i);
          if (match && match[1].toLowerCase() === fileUuid) return true;
        }
      } catch (error) {
        // Malformed legacy URLs do not grant access.
      }
    }
    if (Array.isArray(node.children)) pending.push(...node.children);
  }
  return false;
};
