import logger from "../../../loggers";
import { isRequestTimeout } from "../../../utils";
import DocumentManager from '../managers/document-manager';
import { resetDocContentCursors } from "../models/document-utils";
import { MESSAGE } from '../constants';
import IOHelper from "../wio/io-helper";
import ElementCommandManager from '../managers/element-command-manager';

class DocumentController {

  async applyElementCommands(req, res) {
    const { doc_uuid: docUuid } = req.params;
    const { file_uuid: fileUuid, permission, username, filename: docName, default_title: docTitle } = req.payload || {};

    if (fileUuid !== docUuid || permission !== 'rw' || !username) {
      res.status(403).send({
        error_code: 'permission_denied',
        command_index: null,
        document_version: null,
      });
      return;
    }

    const documentManager = DocumentManager.getInstance();
    try {
      await documentManager.getDoc(docUuid, docName, docTitle, username);
      const document = documentManager.getDocument(docUuid);
      const expectedElements = document.elements;
      const elementCommandManager = new ElementCommandManager();
      const plan = elementCommandManager.prepare(document, req.body);
      const result = await documentManager.commitElementCommands(
        docUuid,
        plan.baseDocumentVersion,
        plan.operations,
        plan.elements,
        { username },
        document,
        expectedElements,
      );

      if (IOHelper.hasInstance()) {
        const ioHelper = IOHelper.getInstance();
        ioHelper.sendDocumentUpdate(docUuid, {
          operations: plan.operations,
          version: result.version,
          user: { username },
        });
      }

      res.status(200).send({
        document_version: result.version,
        command_results: plan.commandResults,
        element_id_mappings: plan.elementIdMappings,
      });
    } catch (err) {
      const errorCode = err.error_code || 'apply_failed';
      const status = errorCode === 'document_version_conflict' ? 409 : errorCode === 'apply_failed' ? 500 : 400;
      const document = documentManager.getDocument(docUuid);
      if (errorCode === 'apply_failed') {
        logger.error(err.message);
      }
      res.status(status).send({
        error_code: errorCode,
        command_index: err.command_index === undefined ? null : err.command_index,
        document_version: document ? document.version : null,
      });
    }
  }

  async loadDocContent(req, res) {
    const { file_uuid: docUuid, filename: docName, username, default_title: docTitle } = req.payload;
    try {
      const documentManager = DocumentManager.getInstance();
      const docContent = await documentManager.getDoc(docUuid, docName, docTitle, username);

      // There is no username when seahub get the sdoc content
      if (!username) {
        res.status(200).send(docContent);
        return;
      }
      const newDocContent = resetDocContentCursors(docContent, username);
      res.set('Cache-control', 'no-store');
      res.send(newDocContent);
      return;
    } catch(err) {
      logger.error(err.message);
      if (isRequestTimeout(err)) {
        logger.error('Request timed out, please try again later');
      }

      if (err.error_type === 'content_load_invalid') {
        logger.error(`Load ${docName}(${docUuid}) from ${err.from_url} error`);
        return res.status(500).send({
          'error_type': 'content_load_invalid',
          'error_msg': 'Internal Server Error'
        });
      }

      if (err.error_type === 'content_invalid') {
        logger.error(err.message);
        return res.status(500).send({
          'error_type': 'content_invalid',
          'error_msg': err.message
        });
      }

      if (err.error_type === 'database_error') {
        logger.error(err.message);
        return res.status(500).send({
          'error_type': 'content_invalid',
          'error_msg': err.message
        });
      }

      logger.error(`Load ${docName}(${docUuid}) doc content error`);
      res.status(500).send({'error_msg': 'Internal Server Error'});
      return;
    }
  }

  async saveDocContent(req, res) {

    const { file_uuid: docUuid, filename: docName } = req.payload;
    const { doc_content: docContent } = req.body;

    if (!docContent) {
      res.status(400).send({"error_msg": `Param 'doc_content' is required`});
      return;
    }

    let content = null;

    try {
      // Form api: need parse string content to object content
      content = JSON.parse(docContent);
    } catch(err) {
      res.status(400).send({"error_msg": `Param 'doc_content' is not in the correct format`});
      return;
    }

    const documentManager = DocumentManager.getInstance();
    const saveFlag = await documentManager.saveDoc(docUuid, docName, content);
    if (saveFlag) { // saved success
      res.send({success: true});
      return;
    }

    res.status(500).send({'error_msg': 'Internal Server Error'});
    return;
  }

  async normalizeSdoc(req, res) {
    const { file_uuid: docUuid } = req.payload;
    try {
      const documentManager = DocumentManager.getInstance();
      await documentManager.normalizeSdoc(docUuid);
      res.send({"success": true});
      return;
    } catch(err) {
      logger.error(err.message);
      if (isRequestTimeout(err)) {
        logger.error('Request timed out, please try again later');
      }
      logger.error(`Normalize doc ${docUuid} failed`);
      res.status(500).send({'error_msg': 'Internal Server Error'});
      return;
    }
  }

  async removeContent(req, res) {
    const { doc_uuid: docUuid } = req.params;
    const ioHelper = IOHelper.getInstance();
    try {
      const documentManager = DocumentManager.getInstance();
      await documentManager.removeDoc(docUuid);
      ioHelper.sendMessageToAllInRoom(docUuid, MESSAGE.DOC_REMOVED);
      res.status(200).send({'success': true});
      return;
    } catch(err) {
      logger.error(err.message);
      if (isRequestTimeout(err)) {
        logger.error('Request timed out, please try again later');
      }
      logger.error(`Remove ${docUuid} doc in memory error`);
      res.status(500).send({'error_msg': 'Internal Server Error'});
      return;
    }
  }

  async saveDoc(req, res) {
    const { doc_uuid: docUuid } = req.params;
    const documentManager = DocumentManager.getInstance();
    try {
      await documentManager.saveDoc(docUuid);
      res.status(200).send({'success': true});
    } catch {
      res.status(500).send({'error_msg': 'Doc save failed'});
    }
  }

  async publishDoc(req, res) {
    const { doc_uuid: docUuid } = req.params;
    const { origin_doc_uuid: originDocUuid, origin_doc_name: originDocName } = req.body;
    const documentManager = DocumentManager.getInstance();

    const ioHelper = IOHelper.getInstance();
    const removeFlag = await documentManager.removeDocFromMemory(docUuid);
    if (!removeFlag) {
      logger.error(`Doc ${docUuid} remove from memory failed`);
      res.status(500).send({'error_msg': 'Internal Server Error'});
      return;
    }
    // Publish only after the queued document removal completes.
    ioHelper.sendMessageToAllInRoom(docUuid, MESSAGE.DOC_PUBLISHED);

    if (!documentManager.isDocInMemory(originDocUuid)) {
      res.status(200).send({'success': true});
      return;
    }

    try {

      // get doc content and add doc into memory
      await documentManager.reloadDoc(originDocUuid, originDocName);
      ioHelper.sendMessageToAllInRoom(originDocUuid, MESSAGE.DOC_REPLACED);
      res.status(200).send({'success': true});
      return;
    } catch(err) {
      logger.error(err.message);
      res.status(500).send({'error_msg': 'Internal Server Error'});
      return;
    }
  }

  async reloadDoc(req, res) {
    const { doc_uuid: docUuid } = req.params;
    const { doc_name: docName } = req.body;
    const documentManager = DocumentManager.getInstance();
    const ioHelper = IOHelper.getInstance();

    if (!documentManager.isDocInMemory(docUuid)) {
      res.status(200).send({'success': true});
      return;
    }

    try {

      // get doc content and add doc into memory
      await documentManager.reloadDoc(docUuid, docName);
      ioHelper.sendMessageToAllInRoom(docUuid, MESSAGE.DOC_REPLACED);
      res.status(200).send({'success': true});
      return;
    } catch(err) {
      logger.error(err.message);
      res.status(500).send({'error_msg': 'Internal Server Error'});
      return;
    }
  }

}

const documentController = new DocumentController();

export default documentController;
