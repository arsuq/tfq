var tracker = (function() {
    const HOST_ELM_ID = 'tracker-host'
    const LS_KEY = 'tracked-items'
    const LS_LIST_PREFIX = "tracked-"
    let ntfdiv = null
    let host = null
    let recursive_marks = 0

    document.addEventListener('DOMContentLoaded', function() {
        ntfdiv = document.getElementById('ntf')
        host = document.getElementById(HOST_ELM_ID)
        load_ls_lists()
        let items = document.querySelector(`[key='tracked-items']`)
        if (items) items.click()
    })

    function load_ls_lists() {
        let listswrp = document.getElementById('ls-lists-wrp')
        if (listswrp) {
            while (listswrp.children.length > 0)
                listswrp.removeChild(listswrp.firstChild)
            for (let k of Object.keys(localStorage))
                if (k.startsWith(LS_LIST_PREFIX)) {
                    let li = document.createElement('span')
                    li.classList.add('list')
                    li.setAttribute('key', k)
                    li.innerText = k.replace(LS_LIST_PREFIX, '')
                    li.onclick = function() {
                        let S = listswrp.querySelectorAll('.selected-list')
                        if (S.length > 0)
                            for (let s of S)
                                if (s != li) s.classList.remove('selected-list')
                        li.classList.toggle('selected-list')
                        load_from_ls(1, k)
                    }
                    listswrp.appendChild(li)
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
            if (k) {
                localStorage.removeItem(k)
                s.remove()
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
        li.classList.add('list')
        li.setAttribute('key', key)
        li.innerText = key.replace(LS_LIST_PREFIX, '')
        li.onclick = function() {
            let S = listswrp.querySelectorAll('.selected-list')
            if (S.length > 0)
                for (let s of S)
                    if (s != li) s.classList.remove('selected-list')
            li.classList.toggle('selected-list')
            load_from_ls(1, key)
        }
        listswrp.appendChild(li)
    }

    function create_item(parent, title = 'title', style = '', append = 1) {
        if (!parent) {
            parent = document.querySelectorAll('.tr-item-selected')
            if (parent.length > 0) parent = parent[0]
            else parent = host
        }
        let pcontent = parent != host ? parent.querySelectorAll('.tr-item-content') : host
        let hostelm = pcontent && pcontent.length > 0 ? pcontent[0] : null;
        if (!hostelm) hostelm = document.getElementById(HOST_ELM_ID)
        let item = document.createElement('div')
        let header = document.createElement('div')
        let content = document.createElement('div')
        let stitle = document.createElement('span')
        let status = document.createElement('span')

        status.innerText = '[+]'

        header.appendChild(status)
        header.appendChild(stitle)
        item.appendChild(header)
        item.appendChild(content)
        if (append > 0) hostelm.appendChild(item)
        else hostelm.parentNode.parentNode.insertBefore(item, hostelm.parentNode.nextSibling)

        item.onclick = function(e) {
            e.preventDefault()
            e.stopPropagation()
            let sel = document.querySelectorAll('.tr-item-selected')
            for (let s of sel)
                if (s != item) s.classList.remove('tr-item-selected')
            item.classList.toggle('tr-item-selected')
        }


        if (style) stitle.setAttribute('style', style)

        stitle.setAttribute('contenteditable', 'true')
        stitle.innerHTML = title
        item.classList.add('tr-item')
        header.classList.add('tr-item-header')
        stitle.classList.add('tr-item-header-title')
        status.classList.add('tr-item-header-status')
        content.classList.add('tr-item-content')

        return item
    }

    function remove_selected() {
        let selected = host.querySelectorAll('.tr-item-selected')
        if (selected.length > 0) {
            for (let s of selected)
                try { s.remove() } catch (ex) {}
            ntf('Items removed', 'ntf-ok')
        }
    }

    function save_to_ls(ls_key = LS_KEY) {
        if (host) {
            let selected_list = document.querySelector('.selected-list')
            if (selected_list) ls_key = selected_list.getAttribute('key')
            let obj = new Map()
            let allitems = host.querySelectorAll('.tr-item-header-title')
            let root = { title: '', subitems: [] }
            for (let i of allitems) {
                let oi = {
                    title: i.innerHTML,
                    style: i.getAttribute('style'),
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
                    let n = create_item(domnode, jsonnode.title, jsonnode.style)
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
        setTimeout(function() {
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
            let C = s.querySelectorAll('.tr-item-content')
            let H = s.querySelectorAll('.tr-item-header')
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

    function set_symbol(symbol) {
        let sh = host.querySelector('.tr-item-selected')
        if (sh) {
            let s = sh.querySelector('.tr-item-header-status')
            if (s) {
                if (!symbol) {
                    let pr = prompt('Type symbol')
                    if (!pr) return
                    symbol = `[${pr}]`
                }
                s.innerText = symbol
                let pp = s.parentElement.parentElement
                if (recursive_marks > 0) {
                    if (!pp.classList.contains('tr-item')) pp == s.parentElement
                    let alldown = pp.querySelectorAll('.tr-item-header-status')
                    for (c of alldown) c.innerText = symbol
                }
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
            const DROPPED = '[-]'
            const CLOSED = '[x]'
            let statuses = host.querySelectorAll('.tr-item-header-status')
            if (statuses.length > 0)
                for (let st of statuses)
                    if (st.innerText == DROPPED || st.innerText == CLOSED) {
                        let p = st.parentElement.parentElement
                        if (p && p.classList.contains('tr-item'))
                            p.remove()
                    }

        } catch (ex) {}
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
        ntf
    }
})()