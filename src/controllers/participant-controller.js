import ParticipantManager from '../managers/participant-manager';

class ParticipantController {

  async addParticipants(req, res) {
    const { doc_uuid: docUuid } = req.params;
    const { users } = req.body;
    const participantManager = ParticipantManager.getInstance();
    try {
      await participantManager.addParticipants(docUuid, users);
      res.status(200).send({ 'success': true });
    } catch (error) {
      res.status(200).send({ 'success': true });
    }
  }

  async removeParticipant(req, res) {
    const { doc_uuid: docUuid } = req.params;
    const { email } = req.body;
    const participantManager = ParticipantManager.getInstance();
    try {
      await participantManager.removeParticipant(docUuid, email);
      res.status(200).send({ 'success': true });
    } catch {
      res.status(200).send({ 'success': true });
    }
  }

}

const participantController = new ParticipantController();

export default participantController;
