# nocfl-js

An opinionated S3 storage library inspired by ocfl but without versioning

# Background

In working with the [Oxford Common File Layout - OCFL](https://ocfl.io) we came to realise that some
quite serious compromises were required. This is not to say that OCFL is not a good specification;
just that we needed something different.

The name of this library came from [Peter Sefton](https://github.com/ptsefton).

# Tests

This library has extensive tests. To run them: `npm run test:watch`. You will need docker as this
command will start a local S3 service called [MinIO](https://hub.docker.com/r/minio/minio/).

# Documentation

[https://coedl.github.io/nocfl-js/](https://coedl.github.io/nocfl-js/)

# About this library

This library is intended to simplify working with data in an S3 bucket. Its primary objective is to
ease the creation and management of data objects in the bucket in a well defined way. Accordingly,
the API is intentionally simple. You define some properties when creating a hook to the bucket and
then get / put data from it. The library will produce an inventory file for you as well as a
skeleton [Research Object Crate - RO-Crate](https://www.researchobject.org/ro-crate).

## Creating a new item

When creating a new item you need to

-   pass in the primary class of the data type (e.g. Collection, Item, Person etc)
-   pass in the item identifier
-   optionally, you can pass in a domain name

Both `id` and `className` must start with letter (upper or lowercase) and be followed by any number
of letters (upper and lower), numbers and underscore. Any other characters will not be accepted and
result in an error. Path creation will use the first letter of the identifier to prefix the item
(this is configurable by defining the splay property in the constructor). The domain and class name
will be lowercased.

Path creation from the identifier is illustrated following:

Examples:

-   class: Collection, id: test -> `(bucket)/collection/t/test (splay = default = 1)`
-   class: Item, id: test -> `(bucket)/item/t/test (splay = default = 1)`
-   domain: example.com, class: Item, id: test ->
    `(bucket)/example.com/item/t/test (splay = default = 1)`
-   domain: eXamPLe.cOm, class: Item, id: test ->
    `(bucket)/example.com/item/t/test (splay = default = 1)`

-   class: Collection, id: test, splay: 2 -> `(bucket)/collection/te/test`
-   class: Collection, id: test, splay: 4 -> `(bucket)/collection/test/test`
-   class: Collection, id: test, splay: 10 -> `(bucket)/collection/test/test`

## Example usage

### Create an item and put a file to it

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
