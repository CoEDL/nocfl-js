# nocfl-js

An opinionated S3 storage library inspired by ocfl but simpler.

[![npm version][npm-version-src]][npm-version-href]
[![npm downloads][npm-downloads-src]][npm-downloads-href]
[![Github Actions][github-actions-src]][github-actions-href]

## Table of Contents

- [nocfl-js](#nocfl-js)
  - [Table of Contents](#table-of-contents)
- [Repository and Documentation](#repository-and-documentation)
- [Background](#background)
- [Developing this library / tests](#developing-this-library--tests)
- [Releasing an update](#releasing-an-update)
- [About this library](#about-this-library)
  - [Research Object Crate Metadata](#research-object-crate-metadata)
  - [Index files](#index-files)
  - [Versioning](#versioning)
  - [Creating a new item](#creating-a-new-item)
- [Load the library](#load-the-library)
- [Store](#store)
  - [Create an item and put a file to it](#create-an-item-and-put-a-file-to-it)
- [Indexer](#indexer)
- [Walker](#walker)

# Repository and Documentation

-   \- Repository: [https://github.com/CoEDL/nocfl-js](https://github.com/CoEDL/nocfl-js)
-   \- Documentation: [https://coedl.github.io/nocfl-js/](https://coedl.github.io/nocfl-js/)

# Background

In working with the [Oxford Common File Layout - OCFL](https://ocfl.io) we came to realise that some
quite serious compromises were required. This is not to say that OCFL is not a good specification;
just that we needed something different.

The name of this library came from [Peter Sefton](https://github.com/ptsefton).

[Why not just use OCFL?](tutorial-why-not-ocfl.html)

# Developing this library / tests

This library has extensive tests. To run them: `npm run test:watch`. You will need docker as this
command will start a local S3 service called [MinIO](https://hub.docker.com/r/minio/minio/).
(`npm run develop` exists as a more semantically meaningful shortcut for test:watch)

The minio credentials are `root`/`rootpass` and are defined in `docker-compose.yml`.

# Releasing an update

-   Tag the release with `npm version {major|minor|patch}` as appropriate
-   Push tags to master with `git push origin master --tags` which will trigger a github action to
    build the distributables and update the docs
-   Publish the release to npm with `npm publish`

# About this library

This library is intended to simplify working with data in an S3 bucket. Its primary objective is to
ease the creation and management of data objects in the bucket in a well defined way. Accordingly,
the API is intentionally simple. You define some properties when creating a hook to the bucket and
then get / put data from it.

## Research Object Crate Metadata

The library will create a metadata file for you -
[Research Object Crate - RO-Crate](https://www.researchobject.org/ro-crate). By default, when you
put a file into the object it will be registered in the `hasPart` property of the root dataset. And
when you remove a file, it's content will also be removed from the crate file.

## Index files

Object storage has no concept of folders so when looking for objects, you have to walk all of the
keys. This can be painful and slow so new items are automatically added to an index file on the
storage. See [Indexer](#indexer) for more information.

## Versioning

This library can version files for you. The versioning is not on by default but it can be
`turned on per file PUT`. When you version a file the following happens - as an example, let's say
the file is called `something.txt`

-   \- the existing file (something.txt) will be copied to `something.v${Date as ISO String}.txt`
-   \- the new version will be uploaded to `something.txt`

Think of the versioned examples as being the content of that file until that point in time. One can
retrieve the versions of a given file by calling the `listFileVersions` method on a given base file
name:

```
listFileVersions({ target: 'something.txt' })
```

## Creating a new item

When creating a new item you need to

-   \- pass in a domain name (really, this is just a string prefix but a domain name is a good
    option)
-   \- pass in the primary class of the data type (e.g. Collection, Item, Person etc)
-   \- pass in the item identifier

Both `id` and `className` must start with letter (upper or lowercase) and be followed by any number
of letters (upper and lower), numbers and underscore. Any other characters will not be accepted and
result in an error. Path creation will use the first letter of the identifier to prefix the item
(this is configurable by defining the splay property in the constructor). The domain and class name
will be lowercased.

Path creation from the identifier is illustrated following:

Examples:

```
-   domain: example.com, class: Item, id: test -> `(bucket)/example.com/item/t/test (splay = default = 1)`
-   domain: eXamPLe.cOm, class: Item, id: test -> `(bucket)/example.com/item/t/test (splay = default = 1)`

-   domain: example.com, class: Collection, id: test, splay: 2 -> `(bucket)/example.com/collection/te/test`
-   domain: example.com, class: Collection, id: test, splay: 4 -> `(bucket)/example.com/collection/test/test`
-   domain: example.com, class: Collection, id: test, splay: 10 -> `(bucket)/example.com/collection/test/test`
```

# Load the library

```

# ES modules
import { Store } from "@coedl/nocfl-js";

# CommonJS
const { Store } = require('@coedl/nocfl-js)

```

# Store

The is the workhorse class to interact with the storage. This is how you get / put files to / from
the storage and just generally work with them.

## Create an item and put a file to it

```
// get a hook to the storage
const store = new Store({ className: "item", id: "test", credentials });

// create the item
await store.createItem();

// upload a file to it
await store.put({ localPath: path.join(__dirname, file), target: file });

// download a file from the storage
await store.get({ target: file, localPath: path.join("/tmp", file) });

// get a pre signed link to a file
let link = await store.getPresignedUrl({ target: file });
```

See the [tests](./src/store.spec.js) for more usage examples.

# Indexer

This class helps you create and manage file based indices of the content on the storage. In Object
storage there is no such thing as a folder. It's key / value pairs where the key (the fully
qualified filename you gave it) points to the file data. That means you can't do things like:

```
ls /data/folder1/today/my/files
```

even though it looks like you have just such a path. Practically this means that whenever you want
to look for something, you have to `walk all of the keys`. Obviously this becomes more and more
painful as the amount of content in the storage grows. So, to shortcut this, you can create index
files to the objects on the storage. And you do that via this class.

```
const indexer = new Indexer({credentials})
await indexer.createIndices({})
```

This will walk the storage and create an `indices folder per domain` which contains a folder for
each type it finds (collection, item, etc) and within those folders, an index file for each letter
of the alphabet:

```
- domain1.example.com
    - indices
        - collection
            - a.json
            - b.json
            - ...
        - item
            - a.json
            - b.json
            - ...
- domain2.example.com
        - collection
            - a.json
            - b.json
            - ...
        - item
            - a.json
            - b.json
            - ...
```

The you can operate on those:

```
// list all indices in the domain
listIndices({ domain: 'domain1.example.com' })

// list all indices of type in the domain
listIndices({ domain: 'domain1.example.com', className: 'collection' })

// get a specific index
getIndex({ domain: 'domain1.example.com', className: 'collection', prefix: 'a'})

or

getIndex({ domain: 'domain1.example.com', className: 'collection', file: 'a.json'})
```

# Walker

The class will walk the storage for you and emit an object you can use with the storage class to
attach to an object in the storage and operate on it.

```
const walker = new Walker({ credentials: this.credentials });
walker.on("object", (object) => {
    let { domain, className, id, splay } = object;

    // do something with object
})
await walker.walk({})
```
