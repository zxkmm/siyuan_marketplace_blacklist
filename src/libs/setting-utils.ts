import { Plugin, Setting } from 'siyuan';

export class SettingUtils {
    plugin: Plugin;
    name: string;
    file: string;

    settings: Map<string, ISettingItem> = new Map();
    elements: Map<string, HTMLElement> = new Map();

    constructor(plugin: Plugin, name?: string, width?: string, height?: string) {
        this.name = name ?? 'settings';
        this.plugin = plugin;
        this.file = this.name.endsWith('.json') ? this.name : `${this.name}.json`;
        this.plugin.setting = new Setting({
            width: width,
            height: height,
            confirmCallback: () => {
                for (let key of this.settings.keys()) {
                    this.updateValue(key);
                }
                let data = this.dump();
                this.plugin.data[this.name] = data;
                this.save();
            }
        });
    }

    async load() {
        let data = await this.plugin.loadData(this.file);
        if (data) {
            for (let [key, item] of this.settings) {
                item.value = data?.[key] ?? item.value;
            }
        }
    }

    async save() {
        let data = this.dump();
        await this.plugin.saveData(this.file, this.dump());
        return data;
    }

    /**
     * Get setting item value
     * @param key key name
     * @returns setting item value
     */
    get(key: string) {
        return this.settings.get(key)?.value;
    }

    /**
     * 将设置项目导出为 JSON 对象
     * @returns object
     */
    dump(): Object {
        let data: any = {};
        for (let [key, item] of this.settings) {
            if (item.type === 'button') continue;
            data[key] = item.value;
        }
        return data;
    }

    addItem(item: ISettingItem) {
        this.settings.set(item.key, item);
        let itemElement: HTMLElement;
        switch (item.type) {
            case 'checkbox':
                let element: HTMLInputElement = document.createElement('input');
                element.type = 'checkbox';
                element.checked = item.value;
                element.className = "b3-switch fn__flex-center";
                itemElement = element;
                break;
            case 'select':
                let selectElement: HTMLSelectElement = document.createElement('select');
                selectElement.className = "b3-select fn__flex-center fn__size200";
                for (let option of item.select?.options ?? []) {
                    let optionElement = document.createElement('option');
                    optionElement.value = option.val;
                    optionElement.text = option.text;
                    selectElement.appendChild(optionElement);
                }
                selectElement.value = item.value;
                itemElement = selectElement;
                break;
            case 'slider':
                let sliderElement: HTMLInputElement = document.createElement('input');
                sliderElement.type = 'range';
                sliderElement.className = 'b3-slider fn__size200';
                sliderElement.ariaLabel = item.value;
                sliderElement.min = item.slider?.min.toString() ?? '0';
                sliderElement.max = item.slider?.max.toString() ?? '100';
                sliderElement.step = item.slider?.step.toString() ?? '1';
                sliderElement.value = item.value;
                itemElement = sliderElement;
                break;
            case 'textinput':
                let textInputElement: HTMLInputElement = document.createElement('input');
                textInputElement.className = 'b3-text-field fn__flex-center fn__size200';
                textInputElement.value = item.value;
                itemElement = textInputElement;
                break;
            case 'textarea':
                let textareaElement: HTMLTextAreaElement = document.createElement('textarea');
                textareaElement.className = "b3-text-field fn__block";
                textareaElement.value = item.value;
                itemElement = textareaElement;
                break;
            case 'button':
                let buttonElement: HTMLButtonElement = document.createElement('button');
                buttonElement.className = "b3-button b3-button--outline fn__flex-center fn__size200";
                buttonElement.innerText = item.button?.label ?? 'Button';
                buttonElement.onclick = item.button?.callback ?? (() => {});
                itemElement = buttonElement;
                break;
        }
        this.elements.set(item.key, itemElement);
        this.plugin.setting.addItem({
            title: item.title,
            description: item?.description,
            createActionElement: () => {
                let element = this.getElement(item.key);
                return element;
            }
        })
    }

    private getElement(key: string) {
        let item = this.settings.get(key);
        let element = this.elements.get(key) as any;
        switch (item.type) {
            case 'checkbox':
                element.checked = item.value;
                break;
            case 'select':
                element.value = item.value;
                break;
            case 'slider':
                element.value = item.value;
                break;
            case 'textinput':
                element.value = item.value;
                break;
            case 'textarea':
                element.value = item.value;
                break;
        }
        return element;
    }

    private updateValue(key: string) {
        let item = this.settings.get(key);
        let element = this.elements.get(key) as any;
        switch (item.type) {
            case 'checkbox':
                item.value = element.checked;
                break;
            case 'select':
                item.value = element.value;
                break;
            case 'slider':
                item.value = element.value;
                break;
            case 'textinput':
                item.value = element.value;
                break;
            case 'textarea':
                item.value = element.value;
                break;
        }
    }

}