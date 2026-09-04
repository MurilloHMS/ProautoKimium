// Deploy do front.
//
// **Problema diferente do da API, e vale saber por quê.** A API troca um
// processo: um container morre, outro nasce, e a troca é atômica. O front troca
// ARQUIVOS numa pasta que o nginx está servindo neste exato instante.
//
// O `rsync --delete` que rodava antes sobrescrevia a pasta no ar. Durante
// alguns segundos ela ficava misturada, e quem tivesse o app aberto pedia um
// chunk que acabara de ser apagado — 404, tela branca, e nenhum sinal de que a
// causa foi o deploy.
//
// A saída é montar a versão nova numa pasta própria e **virar um link** no fim:
//
//   /var/www/proautokimium-app/
//   ├── releases/2.42.6/browser/
//   ├── releases/2.42.7/browser/   ← recém-montada
//   └── current -> releases/2.42.7
//
// O `ln -sfn` troca numa única operação do sistema de arquivos: não existe
// instante em que o link aponte para lugar nenhum.

pipeline {
  // Mesmo motivo do pipeline da API: o agente SSH não tem Docker nem os
  // volumes montados, e `agent any` deixaria o build cair lá de vez em quando.
  agent { label 'built-in' }

  parameters {
    string(name: 'TAG', defaultValue: '', description: 'A tag do git a subir. Ex.: 2.42.7')
  }

  options {
    disableConcurrentBuilds()
    timestamps()
    timeout(time: 30, unit: 'MINUTES')
  }

  environment {
    BASE     = '/var/www/proautokimium-app'
    RELEASES = '/var/www/proautokimium-app/releases'
    ATUAL    = '/var/www/proautokimium-app/current'

    // Quantas versões ficam no disco. Cinco, escolhido por ele: com hard link
    // cada uma extra custa ~8 MB, e a anterior fica a um comando de distância.
    MANTER = '5'

    // A imagem que compila. O Jenkins não precisa de Node instalado: ele já
    // fala com o Docker, e a versão fica escrita aqui em vez de na máquina.
    NODE = 'node:20'
  }

  stages {

    stage('Conferir o terreno') {
      steps {
        script {
          if (!params.TAG?.trim()) error('Sem TAG não há o que subir.')
          currentBuild.displayName = params.TAG
        }

        sh '''
          command -v docker >/dev/null 2>&1 || {
            echo "ERRO: o container do Jenkins nao tem o cliente Docker."; exit 1; }

          docker info >/dev/null 2>&1 || {
            echo "ERRO: nao alcanco o daemon do Docker."; exit 1; }

          [ -w "$BASE" ] || {
            echo "ERRO: nao consigo escrever em $BASE."
            echo "      O Jenkins esta em container e precisa da pasta montada."
            echo "      No compose do Jenkins:"
            echo "        - /var/www/proautokimium-app:/var/www/proautokimium-app"
            exit 1
          }

          mkdir -p "$RELEASES"
        '''
      }
    }

    stage('Buscar a tag') {
      steps {
        checkout([
          $class: 'GitSCM',
          branches: [[name: "refs/tags/${params.TAG}"]],
          extensions: [[$class: 'CloneOption', shallow: true, depth: 1]],
          userRemoteConfigs: scm.userRemoteConfigs
        ])
      }
    }

    stage('Compilar') {
      steps {
        // **`--volumes-from`, e nao `-v`. Aqui esta o conserto.**
        //
        // Duas execucoes falharam com `npm ci` sem lockfile, e o lockfile esta
        // commitado. A causa: `-v "$PWD":/app` e resolvido pelo daemon do HOST,
        // e o `/var/jenkins_home` do host **nao e** o do container. O Docker,
        // ao nao achar o caminho, **cria uma pasta vazia e monta ela** — sem
        // erro, sem aviso.
        //
        // Medido: `ls /var/jenkins_home/workspace/WebSite` no host devolve
        // vazio, enquanto o mesmo caminho dentro do Jenkins tem o projeto.
        //
        // `--volumes-from "$(hostname)"` herda **todas as montagens do proprio
        // Jenkins**, nos mesmos caminhos. Assim o container de build enxerga o
        // workspace sem ninguem precisar saber onde ele fica no host — e
        // continua valendo se amanha o volume mudar de lugar.
        //
        // `$(hostname)` dentro de um container e o id dele, entao isto nao
        // depende do nome `jenkins_sandbox` estar escrito em lugar nenhum.
        //
        // **Antes de compilar, provar que o container esta vendo o codigo.**
        //
        // O `-v "$PWD":/app` e resolvido pelo daemon do HOST, nao pelo Jenkins.
        // Se o caminho nao existir la, o Docker **cria uma pasta vazia** e monta
        // ela — sem erro, sem aviso.
        //
        // E o sintoma engana: `npm ci` procura o lockfile ANTES do package.json,
        // entao uma pasta vazia da o mesmo `EUSAGE` de um projeto sem lockfile.
        // A mensagem fala de npm quando o problema e de montagem.
        sh '''
          if ! docker run --rm --volumes-from "$(hostname)" -w "$PWD" alpine \
               sh -c 'test -f package.json && test -f package-lock.json'; then
            echo "ERRO: o container nao esta enxergando o codigo em $PWD."
            echo ""
            echo "O daemon monta o caminho do HOST. Se ele nao existir la, o"
            echo "Docker cria uma pasta vazia e monta ela, calado."
            echo ""
            echo "Confira se os dois listam a mesma coisa:"
            echo "  docker exec <jenkins> ls $PWD"
            echo "  ls $PWD            # no host"
            echo ""
            echo "O que o Jenkins ve aqui dentro:"
            ls -1 | head -10
            exit 1
          fi
        '''

        // `npm ci` e nao `npm install`: instala exatamente o lockfile, e falha
        // se ele estiver fora de sincronia com o package.json. Build de
        // producao nao e hora de resolver versao nova.
        sh """
          docker run --rm \
            --volumes-from "\$(hostname)" -w "\$PWD" \
            ${NODE} sh -c "npm ci && npm run build -- --configuration production"
        """
      }
    }

    stage('Montar a release') {
      steps {
        // **Aqui mora o hard link, e a armadilha dele.**
        //
        // `cp -al` copia a release anterior criando LINKS em vez de cópias: os
        // 102 MB de imagens e vídeos, que nunca mudam, passam a existir uma vez
        // só no disco. A pasta nova continua completa e independente.
        //
        // E então o detalhe que corrompe tudo se for esquecido: escrever num
        // arquivo hard-linkado altera **os dois nomes**, porque os dados são os
        // mesmos. Copiar o build novo por cima sem cuidado estragaria a release
        // ANTERIOR — justamente a que serve de rollback.
        //
        // `--remove-destination` desfaz o link antes de escrever. É uma flag,
        // e é a diferença entre um rollback que funciona e um que devolve a
        // versão nova achando que é a velha.
        sh '''
          destino="$RELEASES/$TAG"

          rm -rf "$destino"
          mkdir -p "$destino"

          anterior=$(ls -1t "$RELEASES" 2>/dev/null | grep -v "^$TAG\\$" | head -1)
          if [ -n "$anterior" ]; then
            echo "Aproveitando o que nao mudou desde $anterior."
            cp -al "$RELEASES/$anterior/." "$destino/" 2>/dev/null || true
          fi

          cp -r --remove-destination dist/proauto-kimium/browser "$destino/"

          echo "Release montada:"
          du -sh "$destino"
        '''
      }
    }

    stage('Virar o link') {
      steps {
        // A troca. `-n` para tratar o link existente como arquivo, e não
        // seguir para dentro dele; `-f` para substituir. Uma operação só.
        sh '''
          [ -f "$RELEASES/$TAG/browser/index.html" ] || {
            echo "ERRO: a release nao tem index.html. Nao vou virar o link."
            exit 1
          }

          ln -sfn "releases/$TAG" "$ATUAL"
          echo "current -> $(readlink "$ATUAL")"
        '''
      }
    }

    stage('Conferir se subiu') {
      steps {
        // O nginx serve o que estiver na pasta, com status 200, mesmo que seja
        // lixo — então não existe health check de verdade aqui. O que dá para
        // verificar é que o link aponta para a release certa e que o arquivo
        // que o navegador pede primeiro está lá.
        sh '''
          alvo=$(readlink "$ATUAL")
          [ "$alvo" = "releases/$TAG" ] || {
            echo "ERRO: o link aponta para [$alvo], nao para releases/$TAG."
            exit 1
          }

          for arquivo in index.html ngsw.json manifest.webmanifest; do
            if [ -f "$ATUAL/browser/$arquivo" ]; then
              echo "ok: $arquivo"
            else
              echo "AVISO: $arquivo nao encontrado na release."
            fi
          done
        '''
      }
    }
  }

  post {
    failure {
      // Volta o link para a release anterior. Não apaga nada: o disco é o que
      // torna o rollback instantâneo, e apagar no susto é como se perde isso.
      script {
        def anterior = sh(
          script: """
            ls -1t ${RELEASES} 2>/dev/null | grep -v '^${params.TAG}\$' | head -1
          """,
          returnStdout: true
        ).trim()

        if (anterior) {
          echo "Deploy falhou. Voltando o link para ${anterior}."
          sh "ln -sfn 'releases/${anterior}' '${ATUAL}'"
        } else {
          echo 'Deploy falhou e NAO ha release anterior para voltar.'
          echo 'Na primeira execucao isso e esperado.'
        }
      }
    }

    success {
      // Guarda as últimas e apaga o resto. Como as antigas compartilham dados
      // por hard link, apagar uma não estraga as outras: o Linux só libera o
      // espaço quando o último nome some.
      sh '''
        cd "$RELEASES" || exit 0
        ls -1t | tail -n +$((MANTER + 1)) | xargs -r rm -rf
        echo "Releases em disco:"; ls -1t
        du -sh "$RELEASES"
      '''
      echo "No ar: ${params.TAG}"
    }
  }
}
