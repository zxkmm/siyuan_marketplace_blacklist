import {
    Plugin,
    showMessage
} from "siyuan";
import "@/index.scss";

import { SettingUtils } from "./libs/setting-utils";

const STORAGE_NAME = "menu-config";

var packageNameClass = document.getElementsByClassName('ft__on-surface');

export default class siyuan_rmv_btn extends Plugin {

    private settingUtils: SettingUtils;

    convertStringToArray(userInput) {
        if (userInput) {
            var inputArray = userInput.split(/[,，]/);
            for (let i = 0; i < inputArray.length; i++) {
                inputArray[i] = inputArray[i].trim();
            }
            return inputArray;
        } else {
            // 处理 undefined
            return [];
        }
    }

    rmvMarketPlaceCards(_toRemoveListArray_) {

        var siyuanMarketPlaceObserver = new MutationObserver(function(mutationsList, observer) {
            for (var i = 0; i < packageNameClass.length; i++) {
                if (_toRemoveListArray_.includes(packageNameClass[i].textContent)) {
                    if(packageNameClass[i].closest('.b3-card--wrap')){
                    packageNameClass[i].closest('.b3-card--wrap').style.display = 'none';
                    }
                }
            }
        });

        siyuanMarketPlaceObserver.observe(document, {
            childList: true,
            subtree: true,
            characterData: false,
        });
    }


    reloadInterface() {
        // window.location.reload();
        showMessage(this.i18n.reload_hint);
    }

    async onload() {

        this.settingUtils = new SettingUtils(this, STORAGE_NAME);
        this.settingUtils.load();
        this.settingUtils.addItem({
            key: "totalSwitch",
            value: true,
            type: "checkbox",
            title: this.i18n.totalSwitch,
            description: this.i18n.totalSwitchDesc,
        });
        this.settingUtils.addItem({
            key: "pluginBlacklist",
            value: "",
            type: "textarea",
            title: this.i18n.pluginBlacklistTitle,
            description: this.i18n.pluginBlacklistDesc,
        });
        this.settingUtils.addItem({
            key: "pluginBlackListNotes",
            value: "",
            type: "textarea",
            title: this.i18n.pluginBlacklistNoteTitle,
            description: this.i18n.pluginBlacklistNoteDesc,
        });
        this.settingUtils.addItem({
            key: "hint",
            value: "",
            type: "hint",
            title: this.i18n.hintTitle,
            description: this.i18n.hintDesc,
        });
    }

    onLayoutReady() {

        this.loadData(STORAGE_NAME);
        this.settingUtils.load();

        if (this.settingUtils.get("totalSwitch")) {
            this.rmvMarketPlaceCards(
                this.convertStringToArray(
                    this.settingUtils.get("pluginBlacklist")
                )
            )
        }
    }

    async onunload() {
        await this.settingUtils.save();
        // this.reloadInterface();
    }

    uninstall() {
        this.removeData(STORAGE_NAME);
        showMessage(this.i18n.uninstall_hint);
    }

}
