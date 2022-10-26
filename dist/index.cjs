'use strict';

const clientS3 = require('@aws-sdk/client-s3');
const libStorage = require('@aws-sdk/lib-storage');
const s3RequestPresigner = require('@aws-sdk/s3-request-presigner');
const fsExtra = require('fs-extra');
const lodashPkg = require('lodash');
const nodePath = require('path');
const crypto = require('crypto');
const hasha = require('hasha');
const EventEmitter = require('events');
const mime = require('mime-types');

function _interopNamespaceDefault(e) {
    const n = Object.create(null);
    if (e) {
        for (const k in e) {
            n[k] = e[k];
        }
    }
    n.default = e;
    return n;
}

const nodePath__namespace = /*#__PURE__*/_interopNamespaceDefault(nodePath);

const { createReadStream: createReadStream$1, createWriteStream, readdir, stat } = fsExtra;
const { isEmpty } = lodashPkg;
const MB = 1024 * 1024;
const maxFileNameLength = 1024;
class Bucket {
  constructor({
    bucket,
    accessKeyId,
    secretAccessKey,
    region,
    endpoint,
    forcePathStyle = false
  }) {
    if (!bucket) {
      throw new Error(`You must pass in a bucket name to operate on`);
    }
    if (!accessKeyId || !secretAccessKey) {
      throw new Error(`You must pass in 'accessKeyId' && 'secretAccessKey'`);
    }
    if (!region) {
      throw new Error(`You must pass in 'region'`);
    }
    this.bucket = bucket;
    this.configuration = {
      forcePathStyle,
      s3ForcePathStyle: forcePathStyle,
      credentials: {
        accessKeyId,
        secretAccessKey
      },
      region
    };
    if (endpoint)
      this.configuration.endpoint = endpoint;
    this.client = new clientS3.S3Client(this.configuration);
  }
  async stat({ path: path2 }) {
    const params = { Bucket: this.bucket, Key: path2 };
    const command = new clientS3.HeadObjectCommand(params);
    try {
      return await this.client.send(command);
    } catch (error) {
      return false;
    }
  }
  async pathExists({ path: path2 }) {
    return (await this.stat({ path: path2 }))?.$metadata?.httpStatusCode === 200 ? true : false;
  }
  async put({
    localPath = void 0,
    content = void 0,
    json = void 0,
    target = void 0
  }) {
    if (target.length > maxFileNameLength) {
      console.error(
        `The target name '${target}' exceeds the max name length allowed by S3. This file can't be uploaded with that name.`
      );
      return;
    }
    let metadata = {};
    const uploadParams = {
      Bucket: this.bucket,
      Key: target,
      Metadata: metadata
    };
    if (localPath !== void 0) {
      const fileStream = createReadStream$1(localPath);
      fileStream.on("error", function(err) {
        console.log("File Error", err);
      });
      uploadParams.Body = fileStream;
    } else if (content !== void 0 && !isEmpty(content)) {
      uploadParams.Body = Buffer.from(content);
    } else if (json !== void 0) {
      uploadParams.Body = Buffer.from(JSON.stringify(json));
    } else {
      throw new Error(
        `Define 'localPath' || 'content' || 'json'. Precedence is localPath, content, json if you specify more than one.`
      );
    }
    let chunkSize = 5 * MB;
    if (localPath) {
      let fileStat = await stat(localPath);
      const desiredChunkSize = await Math.ceil(fileStat.size / 1e4);
      const minChunkSize = Math.max(5 * MB, Math.ceil(fileStat.size / 1e4));
      chunkSize = Math.max(desiredChunkSize, minChunkSize);
    }
    let uploader = V3MultipartUpload.bind(this);
    let response = await uploader({
      params: uploadParams,
      partSize: chunkSize
    });
    return response;
    async function V3MultipartUpload({ params, partSize }) {
      const uploader2 = new libStorage.Upload({
        client: this.client,
        partSize,
        queueSize: 4,
        leavePartsOnError: false,
        params
      });
      const response2 = await uploader2.done();
      return response2.$metadata;
    }
  }
  async get({ target, localPath }) {
    const downloadParams = { Bucket: this.bucket, Key: target };
    const command = new clientS3.GetObjectCommand(downloadParams);
    let response = await this.client.send(command);
    let data;
    if (!localPath) {
      const chunks = [];
      for await (let chunk of response.Body) {
        chunks.push(chunk);
      }
      data = Buffer.concat(chunks).toString();
      return data;
    } else {
      await new Promise(async (resolve, reject) => {
        const stream = createWriteStream(localPath);
        stream.on("close", resolve);
        stream.on("error", (error) => {
          reject(error);
        });
        response.Body.pipe(stream);
      });
      return response.$metadata;
    }
  }
  async readJSON({ target }) {
    let data = await this.get({ target });
    return JSON.parse(data);
  }
  async copy({ source, target }) {
    source = nodePath.join(this.bucket, source);
    target = nodePath.join(target);
    const command = new clientS3.CopyObjectCommand({
      Bucket: this.bucket,
      CopySource: source,
      Key: target
    });
    return await this.client.send(command);
  }
  async listObjects({
    prefix = void 0,
    startAfter = void 0,
    maxKeys = void 0,
    continuationToken = void 0
  }) {
    const params = {
      Bucket: this.bucket
    };
    if (prefix)
      params.Prefix = prefix;
    if (startAfter)
      params.StartAfter = startAfter;
    if (maxKeys)
      params.MaxKeys = maxKeys;
    if (continuationToken)
      params.ContinuationToken = continuationToken;
    const command = new clientS3.ListObjectsV2Command(params);
    return await this.client.send(command);
  }
  async delete({ keys = [], prefix = void 0 }) {
    if (prefix) {
      let objects = (await this.listObjects({ prefix })).Contents;
      if (objects)
        keys = objects.map((entry) => entry.Key);
    }
    let objs = keys.map((k) => ({ Key: k }));
    if (objs?.length) {
      const command = new clientS3.DeleteObjectsCommand({
        Bucket: this.bucket,
        Delete: { Objects: objs }
      });
      return (await this.client.send(command)).$metadata;
    }
  }
  async syncLocalPathToBucket({ localPath }) {
    let paths = [];
    await walk({ root: localPath, folder: localPath });
    for (let path2 of paths) {
      if (path2.type !== "directory") {
        await this.put({
          localPath: path2.source,
          target: path2.target
        });
      }
    }
    async function walk({ root, folder }) {
      let entries = await readdir(folder, { withFileTypes: true });
      let source, target;
      for (let entry of entries) {
        source = nodePath.join(folder, entry.name);
        target = source.replace(nodePath.join(nodePath.dirname(root), "/"), "");
        paths.push({
          source,
          target,
          type: entry.isDirectory() ? "directory" : "file"
        });
        if (entry.isDirectory()) {
          await walk({ folder: nodePath.join(folder, entry.name), root });
        }
      }
    }
  }
  async getPresignedUrl({ target, expiresIn = 3600, download = false, host }) {
    let filename = nodePath.basename(target);
    const downloadParams = {
      Bucket: this.bucket,
      Key: target
    };
    if (download) {
      downloadParams.ResponseContentDisposition = `response-content-disposition=attachment; filename: ${filename}`;
    }
    const command = new clientS3.GetObjectCommand(downloadParams);
    return await s3RequestPresigner.getSignedUrl(this.client, command, { expiresIn });
  }
}

class Walker extends EventEmitter {
  constructor({ credentials }) {
    super();
    if (!credentials)
      throw new Error(`Missing required property: 'credentials'`);
    const requiredProperties = ["bucket", "accessKeyId", "secretAccessKey", "region"];
    requiredProperties.forEach((property) => {
      if (!credentials[property]) {
        throw new Error(`Missing required property: '${property}'`);
      }
    });
    this.roCrateFile = "ro-crate-metadata.json";
    this.inventoryFile = "nocfl.inventory.json";
    this.identifierFile = "nocfl.identifier.json";
    this.credentials = credentials;
    this.bucket = new Bucket(credentials);
  }
  async walk({ domain = void 0 }) {
    const walker = __walker.bind(this);
    await walker({ domain });
    async function __walker({ continuationToken }) {
      let objects = await this.bucket.listObjects({ continuationToken });
      for (let entry of objects.Contents) {
        let match = false;
        if (domain && entry.Key.match(`${domain}/`) && entry.Key.match(this.identifierFile)) {
          match = true;
        } else if (!domain && entry.Key.match(this.identifierFile)) {
          match = true;
        }
        if (match) {
          let inventory = await this.bucket.readJSON({
            target: entry.Key
          });
          this.emit("object", inventory);
        }
      }
      if (objects.NextContinuationToken) {
        await walker({ domain, continuationToken: objects.NextContinuationToken });
      }
    }
  }
}

const { orderBy, uniqBy: uniqBy$1 } = lodashPkg;
class Indexer {
  constructor({ credentials }) {
    if (!credentials)
      throw new Error(`Missing required property: 'credentials'`);
    const requiredProperties = ["bucket", "accessKeyId", "secretAccessKey", "region"];
    requiredProperties.forEach((property) => {
      if (!credentials[property]) {
        throw new Error(`Missing required property: '${property}'`);
      }
    });
    this.roCrateFile = "ro-crate-metadata.json";
    this.inventoryFile = "nocfl.inventory.json";
    this.identifierFile = "nocfl.identifier.json";
    this.credentials = credentials;
    this.bucket = new Bucket(credentials);
  }
  async createIndices({ domain = void 0 }) {
    const walker = new Walker({ credentials: this.credentials, domain });
    let indices = {};
    walker.on("object", (object) => {
      let { domain: domain2, className, id, splay } = object;
      let idPrefix = id.slice(0, 1).toLowerCase();
      if (!indices[domain2])
        indices[domain2] = {};
      if (!indices[domain2][className])
        indices[domain2][className] = {};
      if (!indices[domain2][className][idPrefix])
        indices[domain2][className][idPrefix] = [];
      indices[domain2][className][idPrefix].push({ domain: domain2, className, id, splay });
    });
    await walker.walk({ domain });
    let indexFiles = [];
    for (let domain2 of Object.keys(indices)) {
      for (let className of Object.keys(indices[domain2])) {
        for (let idPrefix of Object.keys(indices[domain2][className])) {
          let indexFile = `${domain2}/indices/${className}/${idPrefix}.json`;
          indexFiles.push(indexFile);
          await this.bucket.put({
            target: indexFile,
            json: orderBy(indices[domain2][className][idPrefix], "id")
          });
        }
      }
    }
    return indexFiles;
  }
  async patchIndex({ action, domain, className, id, splay = 1 }) {
    if (!["PUT", "DELETE"].includes(action)) {
      throw new Error(`'action' must be one of 'PUT' or 'DELETE'`);
    }
    let indexFileName = `${domain}/indices/${className}/${id.slice(0, 1).toLowerCase()}.json`;
    let indexFile = [];
    try {
      indexFile = await this.bucket.readJSON({ target: indexFileName });
    } catch (error) {
    }
    if (action === "PUT") {
      indexFile.push({ domain, className, id, splay });
    } else if (action === "DELETE") {
      indexFile = indexFile.filter((i) => i.id !== id);
    }
    indexFile = uniqBy$1(indexFile, "id");
    await this.bucket.put({ target: indexFileName, json: indexFile });
  }
  async listIndices({ domain, className }) {
    if (!domain)
      throw new Error(`You must provide 'domain'`);
    let prefix = `${domain}/indices`;
    if (className)
      prefix = `${prefix}/${className}`;
    let files = (await this.bucket.listObjects({ prefix })).Contents;
    files = files.map((f) => f.Key);
    return files;
  }
  async getIndex({ domain, className, prefix, file }) {
    if (!domain)
      throw new Error(`You must provide 'domain'`);
    if (!className)
      throw new Error(`You must provide 'className'`);
    if (!prefix && !file)
      throw new Error(`You must provide one of 'prefix' or 'file'`);
    let indexFile;
    if (file) {
      indexFile = `${domain}/indices/${className}/${file}`;
    } else if (prefix) {
      indexFile = `${domain}/indices/${className}/${prefix}.json`;
    }
    return await this.bucket.readJSON({ target: indexFile });
  }
}

const { createReadStream } = fsExtra;
const { isString, isArray, chunk, uniqBy } = lodashPkg;
const specialFiles = ["nocfl.inventory.json", "nocfl.identifier.json"];
class Store {
  constructor({ domain = void 0, className, id, credentials, splay = 1 }) {
    if (!id)
      throw new Error(`Missing required property: 'id'`);
    if (!domain)
      throw new Error(`Missing required property: 'domain'`);
    if (!className)
      throw new Error(`Missing required property: 'className'`);
    if (!credentials)
      throw new Error(`Missing required property: 'credentials'`);
    const requiredProperties = ["bucket", "accessKeyId", "secretAccessKey", "region"];
    requiredProperties.forEach((property) => {
      if (!credentials[property]) {
        throw new Error(`Missing required property: '${property}'`);
      }
    });
    if (!isString(id)) {
      throw new Error(`The 'id' must be a string`);
    }
    if (!isString(className)) {
      throw new Error(`The 'className' must be a string`);
    }
    if (!isString(domain)) {
      throw new Error(`The 'domain' must be a string`);
    }
    if (!id.match(/^[a-z,A-Z][a-z,A-Z,0-9,_]+$/)) {
      throw new Error(
        `The identifier doesn't match the allowed format: ^[a-z,A-Z][a-z,A-Z,0-9,_]+$`
      );
    }
    if (!className.match(/^[a-z,A-Z][a-z,A-Z,0-9,_]+$/)) {
      throw new Error(
        `The className doesn't match the allowed format: ^[a-z,A-Z][a-z,A-Z,0-9,_]+$`
      );
    }
    this.credentials = credentials;
    this.bucket = new Bucket(credentials);
    this.id = id;
    this.className = className;
    this.domain = domain;
    this.itemPath = `${domain.toLowerCase()}/${className.toLowerCase()}/${id.slice(
      0,
      splay
    )}/${id}`;
    this.splay = splay;
    this.roCrateFile = nodePath__namespace.join(this.itemPath, "ro-crate-metadata.json");
    this.inventoryFile = nodePath__namespace.join(this.itemPath, "nocfl.inventory.json");
    this.identifierFile = nodePath__namespace.join(this.itemPath, "nocfl.identifier.json");
    this.roCrateSkeleton = {
      "@context": [
        "https://w3id.org/ro/crate/1.1/context",
        {
          "@vocab": "http://schema.org/"
        },
        {
          txc: "https://purl.archive.org/textcommons/terms#"
        },
        {
          "@base": null
        }
      ],
      "@graph": [
        {
          "@id": "ro-crate-metadata.json",
          "@type": "CreativeWork",
          conformsTo: {
            "@id": "https://w3id.org/ro/crate/1.1"
          },
          about: {
            "@id": "./"
          },
          identifier: "ro-crate-metadata.json"
        },
        {
          "@id": "./",
          "@type": ["Dataset"],
          name: "My Research Object Crate"
        }
      ]
    };
    this.indexer = new Indexer({ credentials });
  }
  async itemExists() {
    if (await this.bucket.pathExists({ path: this.identifierFile })) {
      return true;
    }
    return false;
  }
  getItemPath() {
    return this.itemPath;
  }
  async getItemIdentifier() {
    return await this.getJSON({ target: "nocfl.identifier.json" });
  }
  async getItemInventory() {
    return await this.getJSON({ target: "nocfl.inventory.json" });
  }
  async pathExists({ path }) {
    let target = nodePath__namespace.join(this.itemPath, path);
    return await this.bucket.pathExists({ path: target });
  }
  async stat({ path }) {
    let target = nodePath__namespace.join(this.itemPath, path);
    return await this.bucket.stat({ path: target });
  }
  async createItem() {
    if (await this.itemExists()) {
      throw new Error(`An item with that identifier already exists`);
    }
    let roCrateFileHash = hasha(JSON.stringify(this.roCrateSkeleton));
    await this.bucket.put({
      target: this.roCrateFile,
      json: this.roCrateSkeleton
    });
    await this.bucket.put({
      target: this.inventoryFile,
      json: { content: { "ro-crate-metadata.json": roCrateFileHash } }
    });
    await this.bucket.put({
      target: this.identifierFile,
      json: {
        id: this.id,
        className: this.className,
        domain: this.domain,
        itemPath: this.itemPath,
        splay: this.splay
      }
    });
    await this.indexer.patchIndex({
      action: "PUT",
      domain: this.domain,
      className: this.className,
      id: this.id,
      splay: this.splay
    });
  }
  async get({ localPath, target }) {
    target = nodePath__namespace.join(this.itemPath, target);
    return await this.bucket.get({ target, localPath });
  }
  async listFileVersions({ target }) {
    target = nodePath__namespace.basename(target, nodePath__namespace.extname(target));
    let files = await this.bucket.listObjects({ prefix: nodePath__namespace.join(this.itemPath, target) });
    let versions = files.Contents.map((c) => c.Key).sort();
    return [...versions.slice(1), versions[0]].reverse();
  }
  async getJSON({ localPath, target }) {
    return JSON.parse(await this.get({ localPath, target }));
  }
  async getPresignedUrl({ target, download }) {
    target = nodePath__namespace.join(this.itemPath, target);
    return await this.bucket.getPresignedUrl({ target, download });
  }
  async put({
    localPath = void 0,
    json = void 0,
    content = void 0,
    target = void 0,
    registerFile = true,
    version = false,
    mimetype = void 0,
    batch = []
  }) {
    if (!await this.itemExists()) {
      throw new Error(`The item doesn't exist`);
    }
    if (!batch.length && !target) {
      return;
    }
    transfer = transfer.bind(this);
    if (batch.length) {
      let chunks = chunk(batch, 5);
      for (let chunk2 of chunks) {
        let transfers = chunk2.map((t) => transfer(t));
        await Promise.all(transfers);
      }
    } else {
      await transfer({ localPath, json, content, target, registerFile, version });
    }
    let crate = await this.getJSON({ target: "ro-crate-metadata.json" });
    if (target && registerFile) {
      crate["@graph"] = await this.__updateCrateMetadata({
        graph: crate["@graph"],
        add_target: target,
        mimetype
      });
    }
    if (batch.length) {
      for (let { target: target2, registerFile: registerFile2 } of batch) {
        registerFile2 = registerFile2 !== void 0 ? registerFile2 : true;
        if (registerFile2) {
          crate["@graph"] = await this.__updateCrateMetadata({
            graph: crate["@graph"],
            add_target: target2,
            mimetype
          });
        }
      }
    }
    await this.bucket.put({
      target: this.roCrateFile,
      json: crate
    });
    async function transfer({ localPath: localPath2, json: json2, content: content2, target: target2, version: version2 }) {
      if (specialFiles.includes(target2)) {
        throw new Error(
          `You can't upload a file called '${target2} as that's a special file used by the system`
        );
      }
      if (localPath2) {
        let hash = await sha512(localPath2);
        await this.__updateInventory({ target: target2, hash });
      } else if (json2) {
        await this.__updateInventory({ target: target2, hash: hasha(JSON.stringify(json2)) });
      } else {
        await this.__updateInventory({ target: target2, hash: hasha(content2) });
      }
      let s3Target = nodePath__namespace.join(this.itemPath, target2);
      if (version2) {
        const date = new Date().toISOString();
        let versionFile = nodePath__namespace.join(
          this.itemPath,
          `${nodePath__namespace.basename(
            target2,
            nodePath__namespace.extname(target2)
          )}.v${date}${nodePath__namespace.extname(target2)}`
        );
        try {
          await this.bucket.copy({ source: s3Target, target: versionFile });
        } catch (error) {
          if (error.message === "The specified key does not exist.") ; else {
            throw new Error(error.message);
          }
        }
        await this.bucket.put({ localPath: localPath2, json: json2, content: content2, target: s3Target });
      } else {
        await this.bucket.put({ localPath: localPath2, json: json2, content: content2, target: s3Target });
      }
    }
  }
  async delete({ target = void 0, prefix = void 0 }) {
    if (specialFiles.includes(target)) {
      throw new Error(
        `You can't delete a file called '${target} as that's a special file used by the system`
      );
    }
    if (!await this.itemExists()) {
      throw new Error(`The item doesn't exist`);
    }
    let crate = await this.getJSON({ target: "ro-crate-metadata.json" });
    if (target) {
      if (!isString(target) && !isArray(target)) {
        throw new Error(`target must be a string or array of strings`);
      }
      if (isString(target))
        target = [target];
      let keys = target.map((t) => nodePath__namespace.join(this.itemPath, t));
      await this.bucket.delete({ keys });
      crate["@graph"] = await this.__updateCrateMetadata({
        graph: crate["@graph"],
        remove_keys: target
      });
    } else if (prefix) {
      if (!isString(prefix)) {
        throw new Error(`prefix must be a string`);
      }
      await this.bucket.delete({ prefix: nodePath__namespace.join(this.itemPath, prefix) });
      crate["@graph"] = await this.__updateCrateMetadata({
        graph: crate["@graph"],
        remove_prefix: prefix
      });
    }
    await this.bucket.put({
      target: this.roCrateFile,
      json: crate
    });
  }
  async deleteItem() {
    if (!await this.itemExists()) {
      throw new Error(`The item doesn't exist`);
    }
    await this.bucket.delete({ prefix: `${this.itemPath}/` });
    await this.indexer.patchIndex({
      action: "DELETE",
      domain: this.domain,
      className: this.className,
      id: this.id,
      splay: this.splay
    });
  }
  async listResources() {
    listItemResources = listItemResources.bind(this);
    let resources = await listItemResources({});
    resources = resources.map((r) => {
      r.Key = r.Key.replace(`${this.itemPath}/`, "");
      return r;
    });
    return resources;
    async function listItemResources({ continuationToken }) {
      let resources2 = await this.bucket.listObjects({
        prefix: `${this.itemPath}/`,
        continuationToken
      });
      if (resources2.NextContinuationToken) {
        return [
          ...resources2.Contents,
          ...await listResources(resources2.NextContinuationToken)
        ];
      } else {
        return resources2.Contents;
      }
    }
  }
  async __updateInventory({ target, hash }) {
    let inventory = JSON.parse(await this.bucket.get({ target: this.inventoryFile }));
    inventory.content[target] = hash;
    await this.bucket.put({
      target: this.inventoryFile,
      json: inventory
    });
  }
  async __updateCrateMetadata({
    graph,
    add_target = void 0,
    remove_keys = [],
    remove_prefix = "",
    mimetype = void 0
  }) {
    let rootDescriptor = graph.filter(
      (e) => e["@id"] === "ro-crate-metadata.json" && e["@type"] === "CreativeWork"
    )[0];
    let rootDataset = graph.filter((e) => e["@id"] === rootDescriptor.about["@id"])[0];
    if (!rootDataset) {
      console.log(`${this.itemPath}/ro-crate-metadata.json DOES NOT have a root dataset`);
      return;
    }
    if (!rootDataset.hasPart)
      rootDataset.hasPart = [];
    if (!isArray(rootDataset.hasPart))
      rootDataset.hasPart = [rootDataset.hasPart];
    if (add_target && add_target !== "ro-crate-metadata.json") {
      const target = add_target;
      rootDataset.hasPart.push({ "@id": target });
      rootDataset.hasPart = uniqBy(rootDataset.hasPart, "@id");
      let fileEntry = graph.filter((e) => e["@id"] === target);
      if (!fileEntry.length) {
        let stat = await this.stat({ path: target });
        if (!mimetype)
          mimetype = mime.lookup(target);
        let entity = {
          "@id": target,
          "@type": "File",
          name: target,
          contentSize: stat.ContentLength,
          dateModified: stat.LastModified,
          "@reverse": {
            hasPart: [{ "@id": "./" }]
          }
        };
        if (mimetype)
          entity.encodingFormat = mimetype;
        graph.push(entity);
      }
    } else if (remove_keys.length) {
      let hasPart = rootDataset.hasPart.filter((e) => {
        return !remove_keys.includes(e["@id"]);
      });
      rootDataset.hasPart = hasPart;
      graph = graph.filter((e) => !remove_keys.includes(e["@id"]));
    } else if (remove_prefix) {
      let re = new RegExp(remove_prefix);
      let hasPart = rootDataset.hasPart.filter((e) => !e["@id"].match(re));
      rootDataset.hasPart = hasPart;
      graph = graph.filter((e) => !e["@id"].match(re));
    } else {
      return graph;
    }
    graph = graph.map((e) => {
      if (e["@id"] === rootDescriptor.about["@id"])
        return rootDataset;
      return e;
    });
    return graph;
  }
}
const sha512 = (path) => new Promise((resolve, reject) => {
  const hash = crypto.createHash("sha512");
  const rs = createReadStream(path);
  rs.on("error", reject);
  rs.on("data", (chunk2) => hash.update(chunk2));
  rs.on("end", () => resolve(hash.digest("hex")));
});

exports.Indexer = Indexer;
exports.Store = Store;
exports.Walker = Walker;