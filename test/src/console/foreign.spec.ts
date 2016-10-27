// Copyright (c) Jupyter Development Team.
// Distributed under the terms of the Modified BSD License.

import expect = require('expect.js');

import {
  Kernel, KernelMessage, utils, Session
} from '@jupyterlab/services';

import {
  clearSignalData, defineSignal, ISignal
} from 'phosphor/lib/core/signaling';

import {
  Panel
} from 'phosphor/lib/ui/panel';

import {
  CodeMirrorConsoleRenderer
} from '../../../lib/console/codemirror/widget';

import {
  ForeignHandler
} from '../../../lib/console/foreign';

import {
  CodeCellModel, CodeCellWidget
} from '../../../lib/notebook/cells';

import {
  defaultRenderMime
} from '../utils';


class TestHandler extends ForeignHandler {

  readonly injected: ISignal<this, void>;

  readonly rejected: ISignal<this, void>;

  dispose(): void {
    if (this.isDisposed) {
      return;
    }
    super.dispose();
    clearSignalData(this);
  }

  protected onIOPubMessage(sender: Kernel.IKernel, msg: KernelMessage.IIOPubMessage): boolean {
    let injected = super.onIOPubMessage(sender, msg);
    if (injected) {
      this.injected.emit(void 0);
    } else {
      // If the message was not injected but otherwise would have been, emit
      // a rejected signal. This should only happen if `enabled` is `false`.
      let session = (msg.parent_header as KernelMessage.IHeader).session;
      if (session !== this.kernel.clientId) {
        this.rejected.emit(void 0);
      }
    }
    return injected;
  }
}


defineSignal(TestHandler.prototype, 'injected');
defineSignal(TestHandler.prototype, 'rejected');


const rendermime = defaultRenderMime();
const renderer: ForeignHandler.IRenderer = {
  createCell: () => {
    let renderer = CodeMirrorConsoleRenderer.defaultCodeCellRenderer;
    let cell = new CodeCellWidget({ rendermime, renderer });
    cell.model = new CodeCellModel();
    return cell;
  }
};


describe('console/foreign', () => {

  describe('ForeignHandler', () => {

    describe('#constructor()', () => {

      it('should create a new foreign handler', () => {
        let options: ForeignHandler.IOptions = {
          kernel: null,
          parent: null,
          renderer
        };
        let handler = new ForeignHandler(options);
        expect(handler).to.be.a(ForeignHandler);
      });

    });

    describe('#enabled', () => {

      it('should default to `true`', () => {
        let options: ForeignHandler.IOptions = {
          kernel: null,
          parent: null,
          renderer
        };
        let handler = new ForeignHandler(options);
        expect(handler.enabled).to.be(true);
      });

      it('should allow foreign cells to be injected if `true`', done => {
        let path = utils.uuid();
        let code = 'print("#enabled:true")';
        let parent = new Panel();
        Promise.all([
          Session.startNew({ path }), Session.startNew({ path })
        ]).then(([a, b]) => {
          let handler = new TestHandler({ kernel: a.kernel, parent, renderer });
          handler.injected.connect(() => {
            a.dispose();
            b.dispose();
            handler.dispose();
            done();
          });
          b.kernel.execute({ code, stop_on_error: true });
        }).catch(done);
      });

      it('should reject foreign cells if `false`', done => {
        let path = utils.uuid();
        let code = 'print("#enabled:false")';
        let parent = new Panel();
        Promise.all([
          Session.startNew({ path }), Session.startNew({ path })
        ]).then(([a, b]) => {
          let handler = new TestHandler({ kernel: a.kernel, parent, renderer });
          handler.enabled = false;
          handler.rejected.connect(() => {
            a.dispose();
            b.dispose();
            handler.dispose();
            done();
          });
          b.kernel.execute({ code, stop_on_error: true });
        }).catch(done);
      });

    });

    describe('#isDisposed', () => {

      it('should indicate whether the handler is disposed', () => {
        let options: ForeignHandler.IOptions = {
          kernel: null,
          parent: null,
          renderer
        };
        let handler = new ForeignHandler(options);
        expect(handler.isDisposed).to.be(false);
        handler.dispose();
        expect(handler.isDisposed).to.be(true);
      });

    });

  });

});
