var gcal = null
var tracker = (function () {
    const HOST_ELM_ID = 'tracker-host'
    const LS_KEY = 'tracked-items'
    const LS_LIST_PREFIX = "tracked-"
    let ntfdiv = null
    let host = null
    let recursive_marks = 0
    let readonly_mode = 0
    let isMobile = false
    let bcollapse = null
    let bexpand = null
    let hiddendiv = null
    let drivefileMap = new Map() // list key, drive file key
    let dragged_in = 0 // not dragged over other items -> move over the root

    document.addEventListener('DOMContentLoaded', function () {
        ntfdiv = document.getElementById('ntf')
        bcollapse = document.getElementById('b-collapse')
        bexpand = document.getElementById('b-expand')
        hiddendiv = document.getElementById('hidden-elements')
        host = document.getElementById(HOST_ELM_ID)
        gcal = goog()
        load_ls_lists()
        let items = document.querySelector(`[key='tracked-items']`)
        if (items) items.click()
        isMobile = window.matchMedia("only screen and (max-width: 760px)")
        host.ondragover = function (e) {
            if (dragged_in < 1 && readonly_mode < 1) {
                e.preventDefault();
                host.classList.add('dragged-over')
            }
        }
        host.ondragleave = function () {
            if (dragged_in < 1 && readonly_mode < 1)
                host.classList.remove('dragged-over')
        }
        host.ondrop = function (e) {
            if (dragged_in < 1 && readonly_mode < 1) {
                e.preventDefault();
                const id = e.dataTransfer.getData('dragged-id')
                if (id) {
                    const dragged = document.getElementById(id)
                    if (dragged) host.appendChild(dragged)
                }
            }
            host.classList.remove('dragged-over')
        }
    })

    document.addEventListener('keydown', function (e) {
        if (readonly_mode > 0) {
            if (e.key == 'Delete') remove_selected()
        }
    })

    function load_ls_lists() {
        let listswrp = document.getElementById('ls-lists-wrp')
        if (listswrp) {
            while (listswrp.children.length > 0)
                listswrp.removeChild(listswrp.firstChild)
            for (let k of Object.keys(localStorage))
                if (k.startsWith(LS_LIST_PREFIX)) {
                    try {
                        let parseval = JSON.parse(localStorage.getItem(k))
                        let li = document.createElement('span')
                        li.id = parseval.id ? parseval.id : new Date().getTime()
                        li.classList.add('list')
                        li.setAttribute('key', k)
                        li.innerText = k.replace(LS_LIST_PREFIX, '')
                        li.onclick = function () {
                            let S = listswrp.querySelectorAll('.selected-list')
                            if (S.length > 0)
                                for (let s of S)
                                    if (s != li) s.classList.remove('selected-list')
                            li.classList.toggle('selected-list')
                            load_from_ls(1, k)
                        }
                        listswrp.appendChild(li)
                    } catch (ex) { }
                }
        }
    }

    function from_list() {
        let listswrp = document.getElementById('ls-lists-wrp')
        if (listswrp) {
            let s = listswrp.querySelector('.selected-list')
            if (s) {
                let k = s.getAttribute('key')
                if (k) load_from_ls(1, k)
            }
        }
    }

    function remove_list() {
        let s = document.querySelector('.selected-list')
        if (s) {
            let k = s.getAttribute('key')
            if (k && confirm('Remove list ' + k + '?')) {
                localStorage.removeItem(k)
                s.remove()
                while (host.children.length > 0)
                    host.removeChild(host.firstChild)
                ntf('List removed', 'ntf-ok')
            }
        }
    }

    function new_list(key) {
        let listswrp = document.getElementById('ls-lists-wrp')
        if (!key) {
            let pr = prompt('List name:')
            if (!pr) return
            key = LS_LIST_PREFIX + pr
        }
        localStorage.setItem(key, JSON.stringify({ title: '', subitems: [] }))
        let li = document.createElement('span')
        li.id = new Date().getTime()
        li.classList.add('list')
        li.setAttribute('key', key)
        li.innerText = key.replace(LS_LIST_PREFIX, '')
        li.onclick = function () {
            let S = listswrp.querySelectorAll('.selected-list')
            if (S.length > 0)
                for (let s of S)
                    if (s != li) s.classList.remove('selected-list')
            li.classList.toggle('selected-list')
            load_from_ls(1, key)
        }
        listswrp.appendChild(li)
    }

    function create_item(parent, id, title = 'title', mark = '+', style = '', append = 1, iscollapsed = 0) {
        if (!parent) {
            if (document.querySelectorAll('.selected-list').length < 1) {
                ntf('Select a list', 'ntf-fail', 4000)
                return
            }
            parent = document.querySelectorAll('.tr-item-selected')
            if (parent.length > 0) parent = parent[0]
            else parent = host
        }
        let pcontent = parent != host ? parent.querySelectorAll('.tr-item-content') : host
        let hostelm = pcontent && pcontent.length > 0 ? pcontent[0] : host
        if (!hostelm) hostelm = document.getElementById(HOST_ELM_ID)
        let item = document.createElement('div')
        let header = document.createElement('div')
        let content = document.createElement('div')
        let stitle = document.createElement('span')
        let status = document.createElement('span')

        status.innerText = mark
        header.appendChild(status)
        header.appendChild(stitle)
        item.appendChild(header)
        item.appendChild(content)
        item.id = id ? id : new Date().getTime()
        if (append > 0 || parent == host) hostelm.appendChild(item)
        else hostelm.parentNode.parentNode.insertBefore(item, hostelm.parentNode.nextSibling)

        item.onclick = function (e) {
            e.preventDefault()
            e.stopPropagation()
            hiddendiv.appendChild(bcollapse)
            hiddendiv.appendChild(bexpand)
            header.classList.remove('dragged-over')
            let sel = document.querySelectorAll('.tr-item-selected')
            for (let s of sel)
                if (s != item) s.classList.remove('tr-item-selected')
            const issel = item.classList.toggle('tr-item-selected')
            const subs = item.querySelectorAll('.tr-item').length
            if (issel === true && subs > 0) {
                header.classList.contains('tr-item-header-collapsed') ?
                    header.appendChild(bexpand) :
                    header.appendChild(bcollapse)
            }
        }

        if (style) stitle.setAttribute('style', style)

        if (readonly_mode < 1) stitle.setAttribute('contenteditable', 'true')
        stitle.innerHTML = title
        item.setAttribute('draggable', 'true')
        item.ondragstart = function (e) {
            if (readonly_mode < 1) e.dataTransfer.setData("dragged-id", e.target.id);
        }
        header.ondragover = function (e) {
            if (readonly_mode < 1) {
                dragged_in = 1
                e.preventDefault();
                header.classList.add('dragged-over')
            }
        }
        header.ondragleave = function () {
            if (readonly_mode < 1) {
                dragged_in = 0
                header.classList.remove('dragged-over')
            }
        }
        header.ondrop = function (e) {
            if (readonly_mode < 1) {
                try {
                    dragged_in = 1
                    e.preventDefault();
                    const id = e.dataTransfer.getData('dragged-id')
                    if (id) {
                        const dragged = document.getElementById(id)
                        if (dragged) content.appendChild(dragged)
                    }
                   
                }
                catch (ex) { }
            }
            header.classList.remove('dragged-over')
        }

        item.classList.add('tr-item')
        header.classList.add('tr-item-header')
        stitle.classList.add('tr-item-header-title')
        status.classList.add('tr-item-header-status')
        content.classList.add('tr-item-content')



        if (iscollapsed === true) {
            header.classList.add('tr-item-header-collapsed')
            content.classList.add('hidden')
        }

        return item
    }

    function remove_selected() {
        let selected = host.querySelectorAll('.tr-item-selected')
        if (selected.length > 0) {
            for (let s of selected)
                try { s.remove() } catch (ex) { }
            ntf('Items removed', 'ntf-ok')
        }
    }

    function save_to_ls(ls_key) {
        if (host) {
            let selected_list = null
            if (!ls_key) {
                selected_list = document.querySelector('.selected-list')
                if (selected_list) ls_key = selected_list.getAttribute('key')
                if (!ls_key) {
                    ntf('Select a list', 'ntf-fail', 3000)
                    return
                }
            } else selected_list = document.querySelector(`[key='${ls_key}'`)
            if (!selected_list) throw 'list not found'
            let obj = new Map()
            let allitems = host.querySelectorAll('.tr-item-header-title')
            let root = { id: selected_list.id, title: '', mark: '', subitems: [] }
            for (let i of allitems) {
                let status = i.parentElement.querySelector('.tr-item-header-status')
                let oi = {
                    id: i.parentElement.parentElement.id,
                    title: i.innerHTML,
                    iscollapsed: i.parentElement.classList.contains('tr-item-header-collapsed'),
                    style: i.getAttribute('style'),
                    mark: status ? status.innerText : '+',
                    subitems: []
                }
                obj.set(i.parentElement.parentElement, oi)
            }
            for (let [k, v] of obj) {
                let domp = k.parentElement.parentElement
                if (domp && domp.classList.contains('tr-item'))
                    obj.get(domp).subitems.push(v)
                else root.subitems.push(v)
            }

            let str = JSON.stringify(root)
            localStorage.setItem(ls_key, str)
            ntf('Saved', 'ntf-ok')
        }
    }

    function load_from_ls(fromcode = 0, ls_key = LS_KEY) {
        if (fromcode > 0 || confirm('Reload tracked items?')) {
            try {
                while (host.children.length > 0)
                    host.removeChild(host.firstChild)

                function make(jsonnode, domnode) {
                    let n = create_item(domnode, jsonnode.id, jsonnode.title, jsonnode.mark, jsonnode.style, 1, jsonnode.iscollapsed)
                    if (jsonnode.subitems)
                        for (let si of jsonnode.subitems)
                            make(si, n)
                }

                let saved = localStorage.getItem(ls_key)
                if (saved) {
                    let parsed = JSON.parse(saved)
                    if (parsed)
                        for (let j of parsed.subitems)
                            make(j, host)
                }
                ntf('Loaded', 'ntf-ok')
            } catch (ex) {
                ntf(`Failed to load items from the ${ls_key} list`, 'ntf-fail', 4000)
            }
        }
    }

    function download() {
        let selected_list = document.querySelector('.selected-list')
        if (selected_list) ls_key = selected_list.getAttribute('key')
        if (ls_key) {
            let ls = localStorage.getItem(ls_key)
            if (ls) {
                const d = new Date()
                const month = (1 + d.getMonth()).toString().padStart(2, '0')
                const day = d.getDate().toString().padStart(2, '0')
                let fn = `${d.getFullYear()}${month}${day}-${ls_key.replace(LS_LIST_PREFIX, '')}.json`
                save_to_file(ls, fn)
            }
        }
    }

    function save_to_file(text, filename, type = 'text/plain') {
        let a = document.createElement("a")
        let file = new Blob([text], { type: type })
        a.href = URL.createObjectURL(file)
        a.download = filename
        a.click()
    }

    function ntf(text, css, dur = 1000) {
        let newntf = document.createElement('div')
        newntf.innerHTML = text
        newntf.classList.add(css)
        newntf.classList.add('newntf')
        ntfdiv.appendChild(newntf)
        newntf.onclick = () => { newntf.remove() }
        setTimeout(function () {
            if (newntf.parentNode == ntfdiv)
                ntfdiv.removeChild(newntf)
        }, dur)
    }

    function parse() {
        let parent = document.querySelectorAll('.tr-item-selected')
        if (parent.length > 0) {
            let title = parent[0].querySelectorAll('.tr-item-header-title')
            if (title.length > 0) {
                title[0].innerHTML = title[0].innerText
            }
        }
    }

    function clear() {
        if (confirm('Confirm clear'))
            while (host.children.length > 0)
                host.removeChild(host.firstChild)
    }

    function toggle(collapse = 1) {
        let s = document.querySelector('.tr-item-selected')
        if (!s) s = host
        if (s) {
            const C = []
            const H = []
            for (const e of s.children)
                if (e.classList.contains('tr-item-content')) C.push(e)
                else if (e.classList.contains('tr-item-header')) H.push(e)
            // let C = s.querySelectorAll('.tr-item-content')
            // let H = s.querySelectorAll('.tr-item-header')
            if (C.length > 0)
                for (let c of C)
                    if (collapse > 0) c.classList.add('hidden')
                    else c.classList.remove('hidden')
            if (H.length > 0)
                for (let h of H)
                    if (collapse > 0) h.classList.add('tr-item-header-collapsed')
                    else h.classList.remove('tr-item-header-collapsed')
        }
    }

    function set_symbol(symbol, style = null, del = 0) {
        let sh = host.querySelector('.tr-item-selected')
        if (sh) {
            let s = sh.querySelector('.tr-item-header-status')
            if (s) {
                if (!symbol) {
                    let pr = prompt('Type symbol')
                    if (!pr) return
                    symbol = pr
                }
                s.innerText = symbol
                let pp = s.parentElement.parentElement
                if (recursive_marks > 0) {
                    if (!pp.classList.contains('tr-item')) pp == s.parentElement
                    const alldown = pp.querySelectorAll('.tr-item-header-status')
                    for (const c of alldown) c.innerText = symbol
                }
            }
            let t = sh.querySelector('.tr-item-header-title')
            if (t) {
                if (style) t.setAttribute('style', style)
                else if (del > 0) t.removeAttribute('style')
            }
            if (recursive_marks > 0) {
                let T = sh.querySelectorAll('.tr-item-header-title')
                if (T && T.length > 0)
                    for (const ct of T)
                        if (style) ct.setAttribute('style', style)
                        else if (del > 0) ct.removeAttribute('style')
            }
        }
    }

    function recursive(btn) {
        btn.classList.toggle('toggle')
        recursive_marks = recursive_marks == 1 ? 0 : 1;
    }

    function up() {
        let sh = host.querySelector('.tr-item-selected')
        if (sh && sh.parentElement.children.length > 1 && sh.previousSibling)
            sh.parentNode.insertBefore(sh, sh.previousSibling);
    }

    function down() {
        let sh = host.querySelector('.tr-item-selected')
        if (sh && sh.parentElement.children.length > 1 && sh.nextSibling)
            sh.nextSibling.parentNode.insertBefore(sh, sh.nextSibling.nextSibling);
    }

    function swipe() {
        try {
            if (!confirm("Swipe all closed or dropped items?")) return
            const DROPPED = '-'
            const CLOSED = 'x'
            let statuses = host.querySelectorAll('.tr-item-header-status')
            if (statuses.length > 0)
                for (let st of statuses)
                    if (st.innerText == DROPPED || st.innerText == CLOSED) {
                        let p = st.parentElement.parentElement
                        if (p && p.classList.contains('tr-item'))
                            p.remove()
                    }

        } catch (ex) { }
    }

    function toggle_buttons_on_header_pin(flag) {
        const E = document.querySelectorAll('.hide-on-header-pin')
        if (E && E.length > 0)
            for (const e of E) e.classList.toggle('hidden', flag)
    }

    function sticktoolbar() {
        let fx = document.getElementById('fixed-header')
        if (fx) {
            if (fx.classList.contains('stick')) {
                fx.classList.remove('stick')
                ntfdiv.classList.remove('stick')
                if (host) host.style.marginTop = '1em'
                toggle_buttons_on_header_pin(false)
            } else {
                fx.classList.add('stick')
                ntfdiv.classList.add('stick')
                let h = document.getElementById(HOST_ELM_ID)
                toggle_buttons_on_header_pin(true)
                let top = document.getElementById('fixed-header').getBoundingClientRect().height
                let title = document.getElementById('tracker-title').getBoundingClientRect().height
                if (h) h.style.marginTop = top - title + 'px'
            }
        }
        // document.getElementById('fixed-header').classList.toggle('stick')
    }

    function mergedrive(listkey, uiclb) {
        if (!gcal) throw 'gcal'
        let list = null
        if (!listkey) {
            let L = document.querySelectorAll('.selected-list')
            if (L.length > 0) list = L[0]
        } else {
            let L = document.querySelectorAll(listkey)
            if (L.length > 0) list = L[0]
        }
        if (!list || !list.getAttribute('key')) {
            ntf('Select a list', 'ntf-fail')
            if (uiclb) uiclb()
            return
        }
        let key = list.getAttribute('key')
        let ldata = localStorage.getItem(key)
        let pdata = ldata ? JSON.parse(ldata) : {}
        const FILENAME = key2filename(key)
        gcal.getdrivefile(FILENAME,
            (d) => {
                if (uiclb) uiclb()
                if (!d) {
                    gcal.updatedrive(1, pdata, null, FILENAME,
                        () => { ntf('The list was uploaded to your google drive as ' + FILENAME, 'ntf-ok') },
                        () => { ntf('Upload failed', 'ntf-fail') })
                } else {
                    drivefileMap.set(key, d.fileid)
                    let mergedlocal = try_merge_objects(pdata, d.result)
                    if (mergedlocal) {
                        let str = JSON.stringify(mergedlocal)
                        localStorage.setItem(key, str)
                        load_from_ls(1, key)
                    }
                }
                ntf('Sync successful', 'ntf-ok')
            },
            (ex) => {
                if (uiclb) uiclb()
                ntf('Sync failed', 'ntf-fail')
            })
    }

    function key2filename(key) {
        return key + '.json'
    }

    function try_merge_objects(localjson, drivejson) {
        if (localjson && drivejson)
            try {
                let M = new Map()

                function allkeys(obj) {
                    if (obj) {
                        let val = M.get(obj.id)
                        if (!val) {
                            val = { set: new Set(), value: obj }
                            M.set(obj.id, val)
                        } else {
                            // override the title, mark, style etc. with the drive data - allkeys(drivejson)
                            for (let k of Object.keys(val.value))
                                if (k != 'subitems') {
                                    if (obj[k] != undefined) val.value[k] = obj[k]
                                    else delete val.value[k]
                                }
                        }
                        for (let node of obj.subitems) {
                            val.set.add(node.id)
                            allkeys(node)
                        }
                    }
                }

                allkeys(localjson)
                allkeys(drivejson)

                for (let v of M.values())
                    if (v.value && v.value.subitems) v.value.subitems = [] // remove old relations
                for (let v of M.values()) {
                    for (let si of v.set.keys()) {
                        let i = M.get(si).value
                        if (i) v.value.subitems.push(i)
                    }
                }

                let rootid = localjson.id != drivejson.id ? drivejson.id : localjson.id
                return M.get(rootid).value

            } catch (ex) {
                console.log(ex)
            }
    }

    function override_google_drive(uiclb) {
        let L = document.querySelectorAll('.selected-list')
        if (L.length > 0) list = L[0]
        if (!list) {
            if (uiclb) uiclb()
            ntf('Select a list', 'ntf-fail')
            return
        }
        let key = list.getAttribute('key')
        if (key) {
            let fileid = drivefileMap.get(key)
            if (!fileid) {
                if (uiclb) uiclb()
                ntf('Merge with google drive first', 'ntf-fail', 4000)
                return
            }
            let ldata = localStorage.getItem(key)
            let pdata = ldata ? JSON.parse(ldata) : {}
            gcal.updatedrive(0, pdata, fileid, null,
                () => {
                    if (uiclb) uiclb()
                    ntf('The list was updated', 'ntf-ok')
                },
                () => {
                    if (uiclb) uiclb()
                    ntf('Upload failed', 'ntf-fail')
                })
        }
    }

    function readonly(btn) {
        readonly_mode = (readonly_mode + 1) % 2
        btn.classList.toggle('toggle', readonly_mode > 0)
        const v = readonly_mode > 0 ? 'false' : 'true'
        const E = document.querySelectorAll(`.tr-item-header-title`)
        if (E && E.length > 0)
            for (const e of E)
                e.setAttribute('contenteditable', v)
    }

    return {
        create_item,
        save_to_ls,
        load_from_ls,
        remove_selected,
        parse,
        clear,
        toggle,
        set_symbol,
        from_list,
        new_list,
        remove_list,
        recursive,
        download,
        up,
        down,
        swipe,
        ntf,
        sticktoolbar,
        readonly,
        mergedrive,
        override_google_drive
    }
})()

function goog() {
    function registerjs() {
        let scr = document.getElementById('goog')
        if (!scr) {
            src = document.createElement('script')
            src.id = 'goog'
            src.onload = function () {
                if (gcal) gapi.load('client:auth2', initClient)
            }
        }
        src.setAttribute('defer', '')
        src.setAttribute('src', 'https://apis.google.com/js/api.js')
        document.head.appendChild(src)
    }

    registerjs()

    const CLIENT_ID = '189775219070-f43ndgfe1sjakmp3q065000ek8tq4f27.apps.googleusercontent.com'
    const API_KEY = 'AIzaSyDjDM4STm3EEz2Q78L2c4RQerlzTcjh604'
    const DISCOVERY_DOCS = ['https://www.googleapis.com/discovery/v1/apis/drive/v3/rest']
    const SCOPES = 'https://www.googleapis.com/auth/drive.file'
    const DRIVE_URL = 'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart'
    const UPDATE_DRIVE_URL = 'https://www.googleapis.com/upload/drive/v3/files/'
    const BOUNDARY = '***';
    let user = null
    let oauthToken = null

    let authorizebtn = document.getElementById('authorize-btn')
    let revokebtn = document.getElementById('revoke-btn')
    let mergebtn = document.getElementById('merge-btn')
    let overridebtn = document.getElementById('override-btn')

    function getdrivefile(drivefilename, clb, clberr) {
        return gapi.client.drive.files.list({
            'q': `name='${drivefilename}' and trashed = false`,
            'orderBy': 'modifiedByMeTime desc'
        }).then(function (response) {
            let files = response.result.files;
            if (files && files.length > 0) {
                gapi.client.drive.files.get({
                    'fileId': files[0].id,
                    'alt': 'media'
                }).then(function (resp) {
                    try {
                        if (resp) clb({ fileid: files[0].id, result: resp.result })
                    } catch (err) { console.log(err) }
                }).catch((er) => {
                    console.log('Failed to load the ' + drivefilename + ' /  ' + er)
                    if (clberr) clberr(er)
                })
            } else clb()
        });
    }

    function updatedrive(upload = 0, data, drivefileid, drivefilename, clb, clbfail) {
        if (oauthToken && data) {
            let updatebody = JSON.stringify(data)
            let body = [,
                '--' + BOUNDARY,
                'Content-Type: application/json; charset=UTF-8', ,
                JSON.stringify({
                    'name': drivefilename,
                    'title': drivefilename,
                    'mimeType': 'application/json'
                }), ,
                '--' + BOUNDARY,
                'Content-Type: application/json', ,
                JSON.stringify(data), ,
                '--' + BOUNDARY + '--'
            ].join('\n')
            fetch(upload > 0 ? DRIVE_URL : UPDATE_DRIVE_URL + drivefileid + '?uploadType=media', {
                method: upload > 0 ? 'POST' : 'PATCH',
                headers: new Headers({
                    'Authorization': 'Bearer ' + oauthToken,
                    'Content-Type': 'multipart/related; boundary=' + BOUNDARY,
                    'Content-Length': upload > 0 ? body.length : updatebody.length
                }),
                body: upload > 0 ? body : updatebody
            }).then(function (d) {
                if (d && clb) clb(d)
            }).catch(function (d) {
                if (clbfail) clbfail()
            });
        }
    }

    function initClient() {
        gapi.client.init({
            apiKey: API_KEY,
            clientId: CLIENT_ID,
            discoveryDocs: DISCOVERY_DOCS,
            scope: SCOPES
        }).then(function () {
            authorizebtn.onclick = () => gapi.auth2.getAuthInstance().signIn().then(() => {
                user = gapi.auth2.getAuthInstance().currentUser.get()
                oauthToken = user.getAuthResponse().access_token
                updateSigninStatus(gapi.auth2.getAuthInstance().isSignedIn.get())
            })
            revokebtn.onclick = () => {
                let auth2 = gapi.auth2.getAuthInstance();
                auth2.signOut().then(() => {
                    gapi.auth2.getAuthInstance().disconnect()
                    updateSigninStatus(false)
                    tracker.ntf('Permissions revoked', 'ntf-ok')
                })
            }
            mergebtn.onclick = () => {
                mergebtn.disabled = true
                tracker.mergedrive(null, () => { mergebtn.disabled = false })
            }
            overridebtn.onclick = () => {
                overridebtn.disabled = true
                tracker.override_google_drive(() => { overridebtn.disabled = false })
            }
        });
    }

    function updateSigninStatus(isSignedIn) {
        if (isSignedIn) {
            authorizebtn.classList.add('hidden')
            revokebtn.classList.remove('hidden')
            overridebtn.classList.remove('hidden')
            mergebtn.classList.remove('hidden')
        } else {
            authorizebtn.classList.remove('hidden')
            revokebtn.classList.add('hidden')
            overridebtn.classList.add('hidden')
            mergebtn.classList.add('hidden')
        }
    }

    return {
        initClient,
        updateSigninStatus,
        getdrivefile,
        updatedrive
    }
}