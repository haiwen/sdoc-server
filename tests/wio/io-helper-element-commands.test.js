import IOHelper from '../../src/modules/sdoc/wio/io-helper';

describe('IOHelper document update broadcast', () => {
  it('uses the existing update-document event for HTTP command changes', () => {
    const emit = jest.fn();
    const io = { to: jest.fn(() => ({ emit })) };
    const ioHelper = IOHelper.getInstance(io);
    const params = { operations: [{ type: 'insert_node' }], version: 5, user: { username: 'writer@example.com' } };

    ioHelper.sendDocumentUpdate('doc-1', params);

    expect(io.to).toHaveBeenCalledWith('doc-1');
    expect(emit).toHaveBeenCalledWith('update-document', params);
  });
});
