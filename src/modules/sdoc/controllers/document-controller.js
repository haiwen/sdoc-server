import logger from "../../../loggers";
import { isRequestTimeout } from "../../../utils";
import DocumentManager from '../managers/document-manager';
import { resetDocContentCursors } from "../models/document-utils";
import { MESSAGE } from '../constants';
import IOHelper from "../wio/io-helper";

const statusToHttp = (result) => {
  switch (result.status) {
    case 'in_progress': return 202;
    case 'preflight_conflicted': return 409;
    case 'applied': return 200;
    case 'outcome_unknown': return 200;
    case 'failed_precommit': return result.error_code === 'document_unavailable' ? 404 : 422;
    default: return 500;
  }
};

class DocumentController {

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
      documentManager.normalizeSdoc(docUuid);
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
      documentManager.removeDoc(docUuid);
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

  async getReviewSnapshot(req, res) {
    const { doc_uuid: requestedDocUuid } = req.params;
    const { file_uuid: docUuid, filename: docName, default_title: docTitle, username } = req.payload;
    if (req.payload.purpose !== 'sdoc_agent_snapshot') {
      res.status(403).send({error_code: 'permission_denied'});
      return;
    }
    if (docUuid !== requestedDocUuid) {
      res.status(403).send({error_code: 'permission_denied'});
      return;
    }
    try {
      const documentManager = DocumentManager.getInstance();
      const documentContext = await documentManager.buildReviewSnapshot(docUuid, docName, docUuid, docTitle, username);
      res.status(200).send({document_context: documentContext});
    } catch (error) {
      logger.error('Load review snapshot failed:', error.message);
      res.status(500).send({error_code: 'load_document_content_error'});
    }
  }

  async applyReviewChangeSet(req, res) {
    const { doc_uuid: requestedDocUuid } = req.params;
    const { file_uuid: docUuid, filename: docName, purpose } = req.payload;
    if (purpose !== 'sdoc_agent_apply') {
      res.status(403).send({error_code: 'permission_denied'});
      return;
    }
    if (docUuid !== requestedDocUuid) {
      res.status(403).send({error_code: 'permission_denied'});
      return;
    }

    const params = req.body || {};
    const requiredClaims = [
      'apply_attempt_id', 'task_id', 'review_decision_id', 'snapshot_id',
      'document_incarnation', 'changeset_revision_id', 'selection_digest',
      'apply_payload_digest', 'approved_by',
    ];
    for (const field of requiredClaims) {
      if (String(req.payload[field]) !== String(params[field])) {
        res.status(403).send({error_code: 'token_claim_mismatch'});
        return;
      }
    }
    if (String(req.payload.card_revision) !== String(params.card_revision)
        || String(req.payload.changeset_revision) !== String(params.changeset_revision)
        || String(req.payload.decision_kind) !== String(params.decision_kind)) {
      res.status(403).send({error_code: 'token_claim_mismatch'});
      return;
    }
    if (params.file_uuid !== docUuid || params.doc_uuid !== docUuid) {
      res.status(403).send({error_code: 'file_identity_mismatch'});
      return;
    }

    try {
      const documentManager = DocumentManager.getInstance();
      const result = await documentManager.applyReviewChangeSet(docUuid, docName, params, req.payload.approved_by);
      res.status(statusToHttp(result)).send(result);
    } catch (error) {
      logger.error('Apply review change set failed:', error.message);
      res.status(500).send({error_code: 'internal_error'});
    }
  }

  async getApplyResult(req, res) {
    const { doc_uuid: requestedDocUuid, apply_attempt_id: applyAttemptId } = req.params;
    const { file_uuid: docUuid, purpose } = req.payload;
    if (purpose !== 'sdoc_agent_apply_result') {
      res.status(403).send({error_code: 'permission_denied'});
      return;
    }
    if (docUuid !== requestedDocUuid) {
      res.status(403).send({error_code: 'permission_denied'});
      return;
    }
    if (String(req.payload.apply_attempt_id) !== String(applyAttemptId)) {
      res.status(403).send({error_code: 'token_claim_mismatch'});
      return;
    }
    try {
      const documentManager = DocumentManager.getInstance();
      const result = await documentManager.getApplyResult(docUuid, applyAttemptId);
      if (result && result.error_code === 'attempt_not_found') {
        res.status(404).send({schema_version: 'sdoc-agent-error/v1', error_code: 'attempt_not_found'});
        return;
      }
      res.status(statusToHttp(result)).send(result);
    } catch (error) {
      logger.error('Get apply result failed:', error.message);
      res.status(500).send({error_code: 'internal_error'});
    }
  }

  async publishDoc(req, res) {
    const { doc_uuid: docUuid } = req.params;
    const { origin_doc_uuid: originDocUuid, origin_doc_name: originDocName } = req.body;
    const documentManager = DocumentManager.getInstance();

    // send message to all: doc has been publish
    const ioHelper = IOHelper.getInstance();
    ioHelper.sendMessageToAllInRoom(docUuid, MESSAGE.DOC_PUBLISHED);

    const removeFlag = await documentManager.removeDocFromMemory(docUuid);
    if (!removeFlag) {
      logger.error(`Doc ${docUuid} remove from memory failed`);
    }

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
