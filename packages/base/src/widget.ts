import { JSONValue } from '@lumino/coreutils';
import { ISignal, Signal } from '@lumino/signaling';
import { SplitPanel } from '@lumino/widgets';

import { ConsolePanel, IConsoleTracker } from '@jupyterlab/console';
import { DocumentWidget } from '@jupyterlab/docregistry';
import { IObservableMap, ObservableMap } from '@jupyterlab/observables';

import { IJupyterGISModel, IJupyterGISWidget } from '@jupytergis/schema';

import { JupyterGISMainViewPanel } from './mainview';
import { MainViewModel } from './mainview/mainviewmodel';
import { ConsoleView } from './console';

export class JupyterGISWidget
  extends DocumentWidget<JupyterGISPanel, IJupyterGISModel>
  implements IJupyterGISWidget
{
  constructor(
    options: DocumentWidget.IOptions<JupyterGISPanel, IJupyterGISModel>
  ) {
    super(options);
  }

  /**
   * Dispose of the resources held by the widget.
   */
  dispose(): void {
    this.content.dispose();
    super.dispose();
  }

  onResize = (msg: any): void => {
    window.dispatchEvent(new Event('resize'));
  };
}

export class JupyterGISPanel extends SplitPanel {
  constructor(options: JupyterGISPanel.IOptions) {
    super({ orientation: 'vertical', spacing: 0 });
    const { model, consoleTracker, ...consoleOption } = options;
    this._initModel({ model });
    this._initView();
    this._consoleOption = consoleOption;
    this._consoleTracker = consoleTracker;
  }

  _initModel(options: { model: IJupyterGISModel }) {
    this._view = new ObservableMap<JSONValue>();
    this._mainViewModel = new MainViewModel({
      jGISModel: options.model,
      viewSetting: this._view
    });
  }

  _initView() {
    this._jupyterGISMainViewPanel = new JupyterGISMainViewPanel({
      mainViewModel: this._mainViewModel
    });
    this.addWidget(this._jupyterGISMainViewPanel);
    SplitPanel.setStretch(this._jupyterGISMainViewPanel, 1);
  }

  get jupyterGISMainViewPanel(): JupyterGISMainViewPanel {
    return this._jupyterGISMainViewPanel;
  }

  get viewChanged(): ISignal<
    ObservableMap<JSONValue>,
    IObservableMap.IChangedArgs<JSONValue>
  > {
    return this._view.changed;
  }

  /**
   * Dispose of the resources held by the widget.
   */
  dispose(): void {
    if (this.isDisposed) {
      return;
    }
    if (this._consoleView) {
      this._consoleView.dispose();
    }
    Signal.clearData(this);
    this._mainViewModel.dispose();
    super.dispose();
  }

  get currentViewModel(): MainViewModel {
    return this._mainViewModel;
  }

  get consolePanel(): ConsolePanel | undefined {
    return this._consoleView?.consolePanel;
  }

  executeConsole() {
    if (this._consoleView) {
      this._consoleView.execute();
    }
  }

  removeConsole() {
    if (this._consoleView) {
      this._consoleView.dispose();
      this._consoleView = undefined;
      this._consoleOpened = false;
      setTimeout(() => {
        window.dispatchEvent(new Event('resize'));
      }, 250);
    }
  }

  async toggleConsole(jgisPath: string) {
    if (!this._consoleView) {
      const {
        contentFactory,
        manager,
        mimeTypeService,
        rendermime,
        commandRegistry
      } = this._consoleOption;
      if (
        contentFactory &&
        manager &&
        mimeTypeService &&
        rendermime &&
        commandRegistry &&
        this._consoleTracker
      ) {
        this._consoleView = new ConsoleView({
          contentFactory,
          manager,
          mimeTypeService,
          rendermime,
          commandRegistry
        });
        const { consolePanel } = this._consoleView;

        (this._consoleTracker.widgetAdded as any).emit(consolePanel);
        await consolePanel.sessionContext.ready;
        await consolePanel.console.inject(
          `from jupytergis_lab import GISDocument\ndoc = GISDocument("${jgisPath}")`
        );
        this.addWidget(this._consoleView);
        this.setRelativeSizes([2, 1]);
        this._consoleOpened = true;
        consolePanel.console.sessionContext.kernelChanged.connect((_, arg) => {
          if (!arg.newValue) {
            this.removeConsole();
          }
        });
      }
    } else {
      if (this._consoleOpened) {
        this._consoleOpened = false;
        this.setRelativeSizes([1, 0]);
      } else {
        this._consoleOpened = true;
        this.setRelativeSizes([2, 1]);
      }
    }
    setTimeout(() => {
      window.dispatchEvent(new Event('resize'));
    }, 250);
  }

  private _mainViewModel: MainViewModel;
  private _view: ObservableMap<JSONValue>;
  private _jupyterGISMainViewPanel: JupyterGISMainViewPanel;
  private _consoleView?: ConsoleView;
  private _consoleOpened = false;
  private _consoleOption: Partial<ConsoleView.IOptions>;
  private _consoleTracker: IConsoleTracker | undefined;
}

export namespace JupyterGISPanel {
  export interface IOptions extends Partial<ConsoleView.IOptions> {
    model: IJupyterGISModel;
    consoleTracker?: IConsoleTracker;
  }
}