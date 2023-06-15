// todo
class DocumentController {

  // 加载内容
  async loadContent(req, res) {
    const { file_uuid: doc_uuid, filename: doc_name } = req.payload;
    try {
      const documentManager = DocumentManager.getInstance();
      const docContent = await documentManager.getDoc(doc_uuid, doc_name);
      res.send(docContent);
      return;
    } catch (error) {
      logger.error(error.message);
      res.status(500).send({'error_msg': 'Internal server error'});
      return;
    }
  }

  // 保存内容
  async saveDocContent(req, res) {
    const { file_uuid: doc_uuid, file_name: doc_name } = req.payload;
    const { doc_content } = req.body;

    let content = null;
    try {
      content = JSON.parse(doc_content);
    } catch (error) {
      res.status(400).send({'error_msg': 'format error'});
      return;
    }

    const documentManager = DocumentManager.getInstance();
    const isSave = await documentManager.saveDoc(doc_uuid, doc_name, content);
    if (isSave) {
      res.send({success: true});
      return;
    }
    res.status(500).send({ 'error_msg': 'Internal server error' });
    return;
  }
}

